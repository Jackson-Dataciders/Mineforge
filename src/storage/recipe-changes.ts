import {
  addKubeJsTask,
  packTasksSchema,
  removeTasksForChange,
  reopenTaskForChange,
} from "@/domain/pack-tasks";
import {
  isChangeId,
  recipeChangeSchema,
  suggestChangeId,
  type RecipeChange,
} from "@/domain/recipe-change";
import { isPackId } from "@/domain/ids";
import { compareCodeUnits } from "@/lib/stable-json";
import { encodeDocument, readDocument, type Versioned } from "./documents";
import { gitBlobSha } from "./git-sha";
import { getModpack } from "./modpacks";
import { newTaskId, readPackTasks } from "./pack-tasks";
import { paths } from "./paths";
import { NotFoundError, type StorageBackend } from "./types";

/**
 * Recipe changes of a modpack, one file each (ADR 0020). Creating, editing
 * and deleting a change also updates its KubeJS task, in the same commit.
 */

/** A change without its ID; the ID is derived on create and never changes. */
export type RecipeChangeInput =
  | Omit<Extract<RecipeChange, { action: "add" }>, "id">
  | Omit<Extract<RecipeChange, { action: "replace" }>, "id">
  | Omit<Extract<RecipeChange, { action: "remove" }>, "id">;

async function requirePack(storage: StorageBackend, packId: string) {
  if (!(await getModpack(storage, packId))) {
    throw new NotFoundError(`modpack ${packId}`);
  }
}

export async function listRecipeChanges(
  storage: StorageBackend,
  packId: string,
): Promise<Versioned<RecipeChange>[]> {
  const entries = (
    await storage.listDir(paths.recipeChangesDir(packId))
  ).filter(
    (e) =>
      e.type === "file" &&
      e.name.endsWith(".json") &&
      isChangeId(e.name.slice(0, -5)),
  );
  const changes = await Promise.all(
    entries.map((e) => readDocument(storage, e.path, recipeChangeSchema)),
  );
  return changes
    .filter((c): c is Versioned<RecipeChange> => c !== null)
    .sort((a, b) => compareCodeUnits(a.data.id, b.data.id));
}

export function getRecipeChange(
  storage: StorageBackend,
  packId: string,
  changeId: string,
): Promise<Versioned<RecipeChange> | null> {
  if (!isPackId(packId) || !isChangeId(changeId)) return Promise.resolve(null);
  return readDocument(
    storage,
    paths.recipeChangeFile(packId, changeId),
    recipeChangeSchema,
  );
}

export async function createRecipeChange(
  storage: StorageBackend,
  packId: string,
  input: RecipeChangeInput,
): Promise<Versioned<RecipeChange>> {
  await requirePack(storage, packId);
  const existing = (await storage.listDir(paths.recipeChangesDir(packId))).map(
    (e) => e.name.replace(/\.json$/, ""),
  );
  const id = suggestChangeId(input.item, existing);
  const data = recipeChangeSchema.parse({ ...input, id });
  const tasks = await readPackTasks(storage, packId);
  const content = encodeDocument(recipeChangeSchema, data);
  const file = paths.recipeChangeFile(packId, id);
  const tasksFile = paths.modpackTasksFile(packId);
  await storage.commit({
    message: `data: add recipe change ${packId}/${id}`,
    changes: [
      { path: file, content },
      {
        path: tasksFile,
        content: encodeDocument(
          packTasksSchema,
          addKubeJsTask(tasks.data, newTaskId(), id),
        ),
      },
    ],
    expected: { [file]: null, [tasksFile]: tasks.sha },
  });
  return { data, sha: gitBlobSha(content) };
}

/** Saves an edited change; its KubeJS task is unchecked, since the script changed. */
export async function updateRecipeChange(
  storage: StorageBackend,
  packId: string,
  changeId: string,
  input: RecipeChangeInput,
  expectedSha: string,
): Promise<Versioned<RecipeChange>> {
  const current = await getRecipeChange(storage, packId, changeId);
  if (!current) throw new NotFoundError(`recipe change ${changeId}`);
  // The item and its name stay as created; only the action and recipe change.
  const data = recipeChangeSchema.parse({
    ...input,
    id: changeId,
    item: current.data.item,
    itemName: current.data.itemName,
  });
  const tasks = await readPackTasks(storage, packId);
  const file = paths.recipeChangeFile(packId, changeId);
  const tasksFile = paths.modpackTasksFile(packId);
  const content = encodeDocument(recipeChangeSchema, data);
  await storage.commit({
    message: `data: update recipe change ${packId}/${changeId}`,
    changes: [
      { path: file, content },
      {
        path: tasksFile,
        content: encodeDocument(
          packTasksSchema,
          addKubeJsTask(
            reopenTaskForChange(tasks.data, changeId),
            newTaskId(),
            changeId,
          ),
        ),
      },
    ],
    expected: { [file]: expectedSha, [tasksFile]: tasks.sha },
  });
  return { data, sha: gitBlobSha(content) };
}

/** Deletes a change and its KubeJS task in one commit. */
export async function deleteRecipeChange(
  storage: StorageBackend,
  packId: string,
  changeId: string,
  expectedSha: string,
): Promise<void> {
  if (!isPackId(packId) || !isChangeId(changeId))
    throw new NotFoundError(`recipe change ${changeId}`);
  const tasks = await readPackTasks(storage, packId);
  const file = paths.recipeChangeFile(packId, changeId);
  const tasksFile = paths.modpackTasksFile(packId);
  const changes: { path: string; content: Uint8Array | null }[] = [
    { path: file, content: null },
  ];
  if (tasks.sha !== null) {
    changes.push({
      path: tasksFile,
      content: encodeDocument(
        packTasksSchema,
        removeTasksForChange(tasks.data, changeId),
      ),
    });
  }
  await storage.commit({
    message: `data: delete recipe change ${packId}/${changeId}`,
    changes,
    expected: { [file]: expectedSha, [tasksFile]: tasks.sha },
  });
}
