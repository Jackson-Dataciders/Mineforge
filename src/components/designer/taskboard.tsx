"use client";

import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type FormEvent,
} from "react";
import { Button, IconButton } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-fields";
import { useApiFailure } from "@/components/ui/use-api-failure";
import { projectPhaseSchema, type ProjectPhase } from "@/domain/custom-mod";
import {
  boardTasks,
  matchesPhase,
  moveGenerated,
  TASK_COLUMNS,
  type BoardTask,
  type DesignerTasks,
  type PhaseFilter,
  type TaskColumn,
} from "@/domain/designer-tasks";
import type { EntryStatus, EntrySummary } from "@/domain/entry";
import { splitEntryId } from "@/domain/entry-id";
import { useT } from "@/i18n/client";
import type { Translate } from "@/i18n/types";
import { fetchJson } from "@/lib/fetch-json";
import { StatusIcon } from "./status-icon";

type VersionedTasks = { data: DesignerTasks; sha: string | null };
type MoveResponse = {
  tasks: VersionedTasks;
  entry: { id: string; status: EntryStatus } | null;
};

// The phase filter is remembered per device (spec 05).
const FILTER_KEY = "mf-task-phase-filter";
const FILTERS: readonly PhaseFilter[] = ["all", ...projectPhaseSchema.options];
const filterListeners = new Set<() => void>();
let filterFallback: PhaseFilter = "all";

function readFilter(): PhaseFilter {
  try {
    const value = window.localStorage.getItem(FILTER_KEY);
    if (FILTERS.includes(value as PhaseFilter)) return value as PhaseFilter;
  } catch {
    // Storage blocked: use the in-memory value.
  }
  return filterFallback;
}

function writeFilter(value: PhaseFilter) {
  filterFallback = value;
  try {
    window.localStorage.setItem(FILTER_KEY, value);
  } catch {
    // Storage blocked: the filter lasts until reload.
  }
  for (const listener of filterListeners) listener();
}

function subscribeFilter(listener: () => void) {
  filterListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    filterListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const boardTaskId = (boardTask: BoardTask) =>
  boardTask.kind === "generated"
    ? `g:${boardTask.key}`
    : `m:${boardTask.task.id}`;

function taskTitle(boardTask: BoardTask, t: Translate) {
  if (boardTask.kind === "manual") return boardTask.task.title;
  return t(`designer.tasks.rules.${boardTask.rule}`, {
    type: t(`entryTypes.${boardTask.entryType}`),
    name: boardTask.entryName,
  });
}

/**
 * The custom mod's taskboard (spec 05): To do, In progress and Done, with
 * drag and drop and "move to" buttons on every task for touch. Generated
 * tasks follow the entries and the current phase; moving one to Done
 * advances its entry, moving it out of Done reverts it. Every write sends
 * the `tasks.json` SHA last seen; a conflict reloads the page.
 */
export function Taskboard({
  modId,
  phase,
  initialTasks,
  initialEntries,
}: {
  modId: string;
  phase: ProjectPhase;
  initialTasks: VersionedTasks;
  initialEntries: EntrySummary[];
}) {
  const t = useT();
  const fail = useApiFailure();
  const [tasks, setTasks] = useState(initialTasks);
  const [entries, setEntries] = useState(initialEntries);
  const [busy, setBusy] = useState(false);
  const [dropTarget, setDropTarget] = useState<TaskColumn | null>(null);
  const [dragged, setDragged] = useState<BoardTask | null>(null);
  const filter = useSyncExternalStore(
    subscribeFilter,
    readFilter,
    () => "all" as const,
  );
  const base = `/api/custom-mods/${modId}/tasks`;

  const visible = useMemo(
    () =>
      boardTasks(entries, phase, tasks.data).filter((c) =>
        matchesPhase(c, filter),
      ),
    [entries, phase, tasks.data, filter],
  );

  /** Columns a task can move to now (generated tasks may be locked). */
  const targets = (boardTask: BoardTask): TaskColumn[] =>
    TASK_COLUMNS.filter(
      (column) =>
        column !== boardTask.column &&
        (boardTask.kind === "manual" ||
          moveGenerated(
            tasks.data,
            boardTask.key,
            column,
            boardTask.entry,
            phase,
          ) !== null),
    );

  async function move(boardTask: BoardTask, column: TaskColumn) {
    if (busy || !targets(boardTask).includes(column)) return;
    setBusy(true);
    const result = await fetchJson<MoveResponse>(`${base}/move`, {
      method: "POST",
      body:
        boardTask.kind === "generated"
          ? { kind: "generated", key: boardTask.key, column, sha: tasks.sha }
          : { kind: "manual", id: boardTask.task.id, column, sha: tasks.sha },
    });
    setBusy(false);
    if (!result.ok) return fail(result.error);
    setTasks(result.data.tasks);
    const changed = result.data.entry;
    if (changed) {
      setEntries((list) =>
        list.map((e) =>
          e.id === changed.id ? { ...e, status: changed.status } : e,
        ),
      );
    }
  }

  async function remove(boardTask: BoardTask) {
    if (busy || boardTask.kind !== "manual") return;
    setBusy(true);
    const result = await fetchJson<VersionedTasks>(
      `${base}/${boardTask.task.id}`,
      {
        method: "DELETE",
        body: { sha: tasks.sha },
      },
    );
    setBusy(false);
    if (result.ok) setTasks(result.data);
    else fail(result.error);
  }

  async function create(input: {
    title: string;
    entryId: string | null;
    phase: ProjectPhase | null;
  }) {
    setBusy(true);
    const result = await fetchJson<VersionedTasks>(base, {
      method: "POST",
      body: { ...input, sha: tasks.sha },
    });
    setBusy(false);
    if (result.ok) setTasks(result.data);
    else fail(result.error);
    return result.ok;
  }

  /** Only columns the dragged task can move to accept the drop. */
  function onDragOver(event: DragEvent, column: TaskColumn) {
    if (!dragged || !targets(dragged).includes(column)) {
      event.dataTransfer.dropEffect = "none";
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(column);
  }

  function onDrop(event: DragEvent, column: TaskColumn) {
    event.preventDefault();
    setDropTarget(null);
    setDragged(null);
    if (dragged) void move(dragged, column);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("designer.tasks.hint")}</p>
      <div className="flex flex-wrap items-end gap-4">
        <NewTaskForm entries={entries} busy={busy} onCreate={create} />
        <SelectField
          label={t("designer.tasks.filterLabel")}
          value={filter}
          options={FILTERS.map((f) => ({
            value: f,
            label:
              f === "all" ? t("designer.tasks.allPhases") : t(`phases.${f}`),
          }))}
          onChange={writeFilter}
          className="w-48"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {TASK_COLUMNS.map((column) => {
          const inColumn = visible.filter((c) => c.column === column);
          const headingId = `tasks-${column}`;
          return (
            <section
              key={column}
              aria-labelledby={headingId}
              onDragOver={(e) => onDragOver(e, column)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDropTarget(null);
                }
              }}
              onDrop={(e) => onDrop(e, column)}
              className={`flex min-h-32 flex-col gap-2 rounded-lg border bg-bg p-2 ${
                dropTarget === column
                  ? "border-accent outline-2 outline-accent"
                  : "border-border"
              }`}
            >
              <h2
                id={headingId}
                className="flex items-center justify-between px-1 text-sm font-semibold"
              >
                {t(`designer.tasks.columns.${column}`)}
                <span className="font-normal text-muted">
                  {inColumn.length}
                </span>
              </h2>
              {inColumn.length === 0 ? (
                <p className="px-1 text-sm text-muted">
                  {t("designer.tasks.empty")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {inColumn.map((boardTask) => (
                    <BoardTaskView
                      key={boardTaskId(boardTask)}
                      boardTask={boardTask}
                      modId={modId}
                      phase={phase}
                      title={taskTitle(boardTask, t)}
                      targets={targets(boardTask)}
                      busy={busy}
                      onMove={(c) => void move(boardTask, c)}
                      onDelete={() => void remove(boardTask)}
                      onDragStart={() => setDragged(boardTask)}
                      onDragEnd={() => {
                        setDragged(null);
                        setDropTarget(null);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardTaskView({
  boardTask,
  modId,
  phase,
  title,
  targets,
  busy,
  onMove,
  onDelete,
  onDragStart,
  onDragEnd,
}: {
  boardTask: BoardTask;
  modId: string;
  /** The mod's current phase. */
  phase: ProjectPhase;
  title: string;
  targets: TaskColumn[];
  busy: boolean;
  onMove: (column: TaskColumn) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  // Why a task can't move: only done generated tasks can be locked.
  const locked =
    boardTask.phase !== null && boardTask.phase !== phase
      ? "designer.tasks.lockedPhase"
      : !boardTask.entry
        ? "designer.tasks.lockedDeleted"
        : "designer.tasks.lockedStatus";
  const done = boardTask.column === "done";
  const entryId =
    boardTask.kind === "generated" ? boardTask.entryId : boardTask.task.entryId;
  return (
    <li
      draggable={targets.length > 0 && !busy}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", boardTaskId(boardTask));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="flex flex-col gap-1 rounded-md border border-border bg-surface p-2"
    >
      <p
        className={`font-medium break-words ${done ? "text-muted line-through" : "text-text"}`}
      >
        {title}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {boardTask.kind === "generated" && (
          <span>{t("designer.tasks.generated")}</span>
        )}
        {boardTask.phase && <span>{t(`phases.${boardTask.phase}`)}</span>}
        {entryId &&
          (boardTask.entry ? (
            <Link
              href={`/designer/${modId}/entries/${splitEntryId(boardTask.entry.id).path}`}
              className="inline-flex min-h-11 items-center gap-1 text-text underline-offset-2 hover:underline"
            >
              <StatusIcon status={boardTask.entry.status} />
              {boardTask.entry.name}
            </Link>
          ) : (
            <span>{t("designer.missing", { id: entryId })}</span>
          ))}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {targets.map((column) => (
          <Button
            key={column}
            onClick={() => onMove(column)}
            disabled={busy}
            aria-label={t("designer.tasks.moveTask", {
              title,
              column: t(`designer.tasks.columns.${column}`),
            })}
            className="px-2"
          >
            <ArrowRight className="size-4" aria-hidden />
            {t(`designer.tasks.columns.${column}`)}
          </Button>
        ))}
        {targets.length === 0 && (
          <span className="text-xs text-muted">{t(locked)}</span>
        )}
        {boardTask.kind === "manual" && (
          <IconButton
            label={t("designer.tasks.delete", { title })}
            onClick={onDelete}
            disabled={busy}
            className="ml-auto"
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        )}
      </div>
    </li>
  );
}

function NewTaskForm({
  entries,
  busy,
  onCreate,
}: {
  entries: readonly EntrySummary[];
  busy: boolean;
  onCreate: (input: {
    title: string;
    entryId: string | null;
    phase: ProjectPhase | null;
  }) => Promise<boolean>;
}) {
  const t = useT();
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [entryId, setEntryId] = useState("");
  const [phase, setPhase] = useState<ProjectPhase | "">("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const ok = await onCreate({
      title,
      entryId: entryId || null,
      phase: phase || null,
    });
    if (ok) setTitle("");
  }

  return (
    <form
      onSubmit={submit}
      aria-label={t("designer.tasks.newTitle")}
      className="flex min-w-0 flex-1 basis-80 flex-wrap items-end gap-2"
    >
      <div className="flex w-full flex-col gap-1 sm:w-auto sm:min-w-48 sm:flex-1">
        <label htmlFor={titleId} className="text-sm font-medium">
          {t("designer.tasks.newTitle")}
        </label>
        <input
          id={titleId}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="min-h-11 min-w-0 rounded-md border border-border bg-bg px-3 text-base text-text"
        />
      </div>
      <SelectField
        label={t("designer.tasks.entryLabel")}
        value={entryId}
        options={[
          { value: "", label: t("designer.tasks.noEntry") },
          ...entries.map((e) => ({ value: e.id, label: e.name })),
        ]}
        onChange={setEntryId}
        className="w-44"
      />
      <SelectField<ProjectPhase | "">
        label={t("designer.tasks.phaseLabel")}
        value={phase}
        options={[
          { value: "", label: t("designer.tasks.noPhase") },
          ...projectPhaseSchema.options.map((p) => ({
            value: p,
            label: t(`phases.${p}`),
          })),
        ]}
        onChange={setPhase}
        className="w-44"
      />
      <Button type="submit" variant="primary" disabled={busy || !title.trim()}>
        {t("designer.tasks.add")}
      </Button>
    </form>
  );
}
