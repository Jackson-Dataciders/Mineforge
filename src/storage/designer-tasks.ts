import type { ProjectPhase } from "@/domain/custom-mod";
import {
  addManualTask,
  designerTasksSchema,
  EMPTY_DESIGNER_TASKS,
  moveGenerated,
  moveManualTask as moveManual,
  parseTaskKey,
  pruneGenerated,
  removeManualTask,
  type DesignerTasks,
  type TaskColumn,
} from "@/domain/designer-tasks";
import {
  entrySchema,
  summarizeEntry,
  type Entry,
  type EntryStatus,
} from "@/domain/entry";
import { splitEntryId } from "@/domain/entry-id";
import { isModId } from "@/domain/ids";
import { stableStringify } from "@/lib/stable-json";
import { getCustomMod } from "./custom-mods";
import { encodeDocument, readDocument, type Versioned } from "./documents";
import { listEntries } from "./entries";
import { gitBlobSha } from "./git-sha";
import { newTaskId } from "./pack-tasks";
import { paths } from "./paths";
import {
  NotFoundError,
  ValidationError,
  type FileChange,
  type StorageBackend,
} from "./types";

/**
 * Custom mod tasks (spec 05, ADR 0022). Every write sends the `tasks.json`
 * SHA the client last saw and also expects `mod.json` unchanged, so a phase
 * change elsewhere becomes a conflict. Completing or reopening a generated
 * task writes the entry's status in the same commit.
 */

/** `tasks.json` with its SHA; `sha: null` means the file doesn't exist yet. */
export type VersionedDesignerTasks = {
  data: DesignerTasks;
  sha: string | null;
};

export async function readDesignerTasks(
  storage: StorageBackend,
  modId: string,
): Promise<VersionedDesignerTasks> {
  const doc = isModId(modId)
    ? await readDocument(
        storage,
        paths.customModTasksFile(modId),
        designerTasksSchema,
      )
    : null;
  return doc ?? { data: EMPTY_DESIGNER_TASKS, sha: null };
}

type Loaded = {
  modSha: string;
  phase: ProjectPhase;
  entries: Versioned<Entry>[];
  tasks: VersionedDesignerTasks;
};

async function load(storage: StorageBackend, modId: string): Promise<Loaded> {
  const mod = await getCustomMod(storage, modId);
  if (!mod) throw new NotFoundError(`custom mod ${modId}`);
  const [entries, tasks] = await Promise.all([
    listEntries(storage, modId),
    readDesignerTasks(storage, modId),
  ]);
  return { modSha: mod.sha, phase: mod.data.phase, entries, tasks };
}

/**
 * Writes the new task state (with stale in-progress state pruned), plus any
 * entry changes, in one commit.
 */
async function writeTasks(
  storage: StorageBackend,
  modId: string,
  loaded: Loaded,
  next: DesignerTasks,
  expectedSha: string | null,
  message: string,
  entryChange?: { entry: Versioned<Entry>; status: EntryStatus },
): Promise<VersionedDesignerTasks> {
  const entries = loaded.entries.map((e) =>
    summarizeEntry(
      entryChange && e.data.id === entryChange.entry.data.id
        ? { ...e.data, status: entryChange.status }
        : e.data,
    ),
  );
  const data = pruneGenerated(next, entries, loaded.phase);
  if (
    !entryChange &&
    expectedSha === loaded.tasks.sha &&
    stableStringify(data) === stableStringify(loaded.tasks.data)
  ) {
    return loaded.tasks; // nothing to write
  }
  const file = paths.customModTasksFile(modId);
  const content = encodeDocument(designerTasksSchema, data);
  const changes: FileChange[] = [{ path: file, content }];
  const expected: Record<string, string | null> = {
    [file]: expectedSha,
    [paths.customModFile(modId)]: loaded.modSha,
  };
  if (entryChange) {
    const { entry, status } = entryChange;
    const entryFile = paths.entryFile(modId, splitEntryId(entry.data.id).path);
    changes.push({
      path: entryFile,
      content: encodeDocument(entrySchema, { ...entry.data, status }),
    });
    expected[entryFile] = entry.sha;
  }
  await storage.commit({ message, changes, expected });
  return { data, sha: gitBlobSha(content) };
}

export type GeneratedMoveResult = {
  tasks: VersionedDesignerTasks;
  /** The entry whose status changed, with its new status. */
  entry: { id: string; status: EntryStatus } | null;
};

/**
 * Moves a generated task between columns. Moving to Done completes it
 * (advancing the entry's status); moving out of Done reopens it (reverting
 * the status). Refused with `taskNotMovable` if the task is not of the
 * current phase or its entry's status no longer fits.
 */
export async function moveGeneratedTask(
  storage: StorageBackend,
  modId: string,
  key: string,
  column: TaskColumn,
  expectedSha: string | null,
): Promise<GeneratedMoveResult> {
  const loaded = await load(storage, modId);
  const parsed = parseTaskKey(key);
  if (!parsed || splitEntryId(parsed.entryId).modId !== modId) {
    throw new NotFoundError(`task ${key}`);
  }
  const entry = loaded.entries.find((e) => e.data.id === parsed.entryId);
  const move = moveGenerated(
    loaded.tasks.data,
    key,
    column,
    entry ? summarizeEntry(entry.data) : null,
    loaded.phase,
  );
  if (!move) throw new ValidationError("taskNotMovable");
  const entryChange =
    move.status && entry ? { entry, status: move.status } : undefined;
  const verb = column === "done" ? "complete" : entryChange ? "reopen" : "move";
  const tasks = await writeTasks(
    storage,
    modId,
    loaded,
    move.state,
    expectedSha,
    `data: ${verb} task ${key}`,
    entryChange,
  );
  return {
    tasks,
    entry: entryChange
      ? { id: entryChange.entry.data.id, status: entryChange.status }
      : null,
  };
}

export async function createManualTask(
  storage: StorageBackend,
  modId: string,
  input: { title: string; entryId: string | null; phase: ProjectPhase | null },
  expectedSha: string | null,
): Promise<VersionedDesignerTasks> {
  const loaded = await load(storage, modId);
  if (
    input.entryId !== null &&
    !loaded.entries.some((e) => e.data.id === input.entryId)
  ) {
    throw new ValidationError("unknownEntry");
  }
  const next = addManualTask(loaded.tasks.data, {
    id: newTaskId(),
    title: input.title.trim(),
    entryId: input.entryId,
    phase: input.phase,
    column: "to_do",
  });
  return writeTasks(
    storage,
    modId,
    loaded,
    designerTasksSchema.parse(next),
    expectedSha,
    `data: add task to custom mod ${modId}`,
  );
}

async function loadWithManual(
  storage: StorageBackend,
  modId: string,
  taskId: string,
) {
  const loaded = await load(storage, modId);
  if (!loaded.tasks.data.manual.some((t) => t.id === taskId)) {
    throw new NotFoundError(`task ${taskId}`);
  }
  return loaded;
}

export async function moveManualTask(
  storage: StorageBackend,
  modId: string,
  taskId: string,
  column: TaskColumn,
  expectedSha: string | null,
): Promise<VersionedDesignerTasks> {
  const loaded = await loadWithManual(storage, modId, taskId);
  return writeTasks(
    storage,
    modId,
    loaded,
    moveManual(loaded.tasks.data, taskId, column),
    expectedSha,
    `data: move task ${taskId} in custom mod ${modId}`,
  );
}

export async function deleteManualTask(
  storage: StorageBackend,
  modId: string,
  taskId: string,
  expectedSha: string | null,
): Promise<VersionedDesignerTasks> {
  const loaded = await loadWithManual(storage, modId, taskId);
  return writeTasks(
    storage,
    modId,
    loaded,
    removeManualTask(loaded.tasks.data, taskId),
    expectedSha,
    `data: delete task ${taskId} in custom mod ${modId}`,
  );
}
