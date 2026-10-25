import {
  addManualTask,
  EMPTY_PACK_TASKS,
  packTasksSchema,
  removeTask,
  setTaskDone,
  type PackTasks,
} from "@/domain/pack-tasks";
import { encodeDocument, readDocument } from "./documents";
import { getModpack } from "./modpacks";
import { paths } from "./paths";
import { NotFoundError, ValidationError, type StorageBackend } from "./types";

/** `tasks.json` with its SHA; `sha: null` means the file doesn't exist yet. */
export type VersionedTasks = { data: PackTasks; sha: string | null };

export async function readPackTasks(
  storage: StorageBackend,
  packId: string,
): Promise<VersionedTasks> {
  const doc = await readDocument(
    storage,
    paths.modpackTasksFile(packId),
    packTasksSchema,
  );
  return doc ?? { data: EMPTY_PACK_TASKS, sha: null };
}

/** New task ID: 12 lowercase hex characters. */
export const newTaskId = () =>
  globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);

async function writeTasks(
  storage: StorageBackend,
  packId: string,
  data: PackTasks,
  expectedSha: string | null,
  message: string,
): Promise<VersionedTasks> {
  const { sha } = await storage.writeFile(
    paths.modpackTasksFile(packId),
    encodeDocument(packTasksSchema, data),
    expectedSha,
    message,
  );
  return { data, sha };
}

async function current(
  storage: StorageBackend,
  packId: string,
): Promise<VersionedTasks> {
  if (!(await getModpack(storage, packId))) {
    throw new NotFoundError(`modpack ${packId}`);
  }
  return readPackTasks(storage, packId);
}

/**
 * Applies a change to the tasks as read now, writing with the SHA the client
 * last saw, so a concurrent change elsewhere becomes a conflict.
 */
async function updateTasks(
  storage: StorageBackend,
  packId: string,
  expectedSha: string | null,
  message: string,
  apply: (tasks: PackTasks) => PackTasks,
): Promise<VersionedTasks> {
  const { data } = await current(storage, packId);
  return writeTasks(storage, packId, apply(data), expectedSha, message);
}

export function createManualPackTask(
  storage: StorageBackend,
  packId: string,
  title: string,
  expectedSha: string | null,
): Promise<VersionedTasks> {
  return updateTasks(
    storage,
    packId,
    expectedSha,
    `data: add task to modpack ${packId}`,
    (tasks) => addManualTask(tasks, newTaskId(), title),
  );
}

export function setPackTaskDone(
  storage: StorageBackend,
  packId: string,
  taskId: string,
  done: boolean,
  expectedSha: string | null,
): Promise<VersionedTasks> {
  return updateTasks(
    storage,
    packId,
    expectedSha,
    `data: ${done ? "check" : "uncheck"} task in modpack ${packId}`,
    (tasks) => {
      if (!tasks.tasks.some((t) => t.id === taskId)) {
        throw new NotFoundError(`task ${taskId}`);
      }
      return setTaskDone(tasks, taskId, done);
    },
  );
}

/** Deletes a manual task; KubeJS tasks go away with their recipe change. */
export function deletePackTask(
  storage: StorageBackend,
  packId: string,
  taskId: string,
  expectedSha: string | null,
): Promise<VersionedTasks> {
  return updateTasks(
    storage,
    packId,
    expectedSha,
    `data: delete task in modpack ${packId}`,
    (tasks) => {
      const task = tasks.tasks.find((t) => t.id === taskId);
      if (!task) throw new NotFoundError(`task ${taskId}`);
      if (task.type !== "manual") throw new ValidationError("notManualTask");
      return removeTask(tasks, taskId);
    },
  );
}
