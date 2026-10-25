"use client";

import { Download, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { useApiFailure } from "@/components/ui/use-api-failure";
import { orderTasks, type PackTask, type PackTasks } from "@/domain/pack-tasks";
import { useT } from "@/i18n/client";
import { fetchJson } from "@/lib/fetch-json";

type VersionedTasks = { data: PackTasks; sha: string | null };

/**
 * The pack's task list (spec 03): manual tasks and "Write KubeJS" tasks.
 * Open tasks first, done tasks greyed out at the bottom. Every write sends
 * the `tasks.json` SHA last seen; a conflict reloads the page.
 */
export function PackTaskList({
  packId,
  initial,
  itemNames,
}: {
  packId: string;
  initial: VersionedTasks;
  /** Item name per recipe change ID, for KubeJS task titles. */
  itemNames: Record<string, string>;
}) {
  const t = useT();
  const fail = useApiFailure();
  const [tasks, setTasks] = useState(initial);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/modpacks/${packId}/tasks`;

  async function run(
    request: Promise<
      { ok: true; data: VersionedTasks } | { ok: false; error: string }
    >,
  ) {
    setBusy(true);
    const result = await request;
    setBusy(false);
    if (result.ok) setTasks(result.data);
    else fail(result.error);
    return result.ok;
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const ok = await run(
      fetchJson<VersionedTasks>(base, {
        method: "POST",
        body: { title, sha: tasks.sha },
      }),
    );
    if (ok) setTitle("");
  }

  const toggle = (task: PackTask) =>
    run(
      fetchJson<VersionedTasks>(`${base}/${task.id}`, {
        method: "PATCH",
        body: { done: !task.done, sha: tasks.sha },
      }),
    );

  const remove = (task: PackTask) =>
    run(
      fetchJson<VersionedTasks>(`${base}/${task.id}`, {
        method: "DELETE",
        body: { sha: tasks.sha },
      }),
    );

  const titleOf = (task: PackTask) =>
    task.type === "manual"
      ? task.title
      : t("tasks.writeKubeJs", {
          item: itemNames[task.recipeChangeId] ?? task.recipeChangeId,
        });

  const ordered = orderTasks(tasks.data.tasks);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{t("tasks.title")}</h2>
      <form onSubmit={add} className="flex gap-2">
        <label htmlFor="new-pack-task" className="sr-only">
          {t("tasks.addLabel")}
        </label>
        <input
          id="new-pack-task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("tasks.addLabel")}
          maxLength={200}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-base text-text"
        />
        <Button type="submit" disabled={busy || !title.trim()}>
          {t("tasks.add")}
        </Button>
      </form>
      {ordered.length === 0 ? (
        <p className="text-muted">{t("tasks.none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {ordered.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-x-2 px-2 py-1"
            >
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => void toggle(task)}
                  disabled={busy}
                  className="size-5 shrink-0 accent-accent"
                />
                <span className={task.done ? "text-muted line-through" : ""}>
                  {titleOf(task)}
                </span>
              </label>
              {task.type === "kubejs" && (
                <a
                  href={`/api/modpacks/${packId}/recipe-changes/${task.recipeChangeId}/script`}
                  download
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-text hover:bg-accent/13"
                >
                  <Download className="size-4" aria-hidden />
                  {t("tasks.export")}
                </a>
              )}
              {task.type === "manual" && (
                <IconButton
                  label={t("tasks.delete")}
                  onClick={() => void remove(task)}
                  disabled={busy}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
