import {
  customModSchema,
  type CustomMod,
  type ProjectPhase,
} from "@/domain/custom-mod";
import {
  customRecipeTypeSchema,
  type CustomRecipeType,
} from "@/domain/custom-recipe";
import { splitEntryId } from "@/domain/entry-id";
import { isModId, RESERVED_MOD_IDS } from "@/domain/ids";
import { modpackSchema } from "@/domain/modpack";
import { encodeDocument, readDocument, type Versioned } from "./documents";
import { summarizeEntry } from "@/domain/entry";
import { getEntry, listEntries } from "./entries";
import { gitBlobSha } from "./git-sha";
import { loadLibraryMetas } from "./library";
import { listModpacks } from "./modpacks";
import { paths } from "./paths";
import { pruneTasksChange } from "./task-prune";
import {
  NotFoundError,
  ValidationError,
  type FileChange,
  type StorageBackend,
} from "./types";

export async function listCustomMods(
  storage: StorageBackend,
): Promise<Versioned<CustomMod>[]> {
  const dirs = (await storage.listDir(paths.customModsDir)).filter(
    (e) => e.type === "dir" && isModId(e.name),
  );
  const mods = await Promise.all(
    dirs.map((d) =>
      readDocument(storage, paths.customModFile(d.name), customModSchema),
    ),
  );
  return mods
    .filter((m): m is Versioned<CustomMod> => m !== null)
    .sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export function getCustomMod(storage: StorageBackend, modId: string) {
  if (!isModId(modId)) return Promise.resolve(null);
  return readDocument(storage, paths.customModFile(modId), customModSchema);
}

export async function createCustomMod(
  storage: StorageBackend,
  input: { modId: string; name: string },
): Promise<Versioned<CustomMod>> {
  if (!isModId(input.modId)) throw new ValidationError("invalidId");
  if (RESERVED_MOD_IDS.has(input.modId)) {
    throw new ValidationError("idReserved");
  }
  const libraryIds = (await storage.listDir(paths.libraryDir)).map(
    (e) => e.name,
  );
  if (libraryIds.includes(input.modId))
    throw new ValidationError("idTakenByLibrary");
  if (await storage.readFile(paths.customModFile(input.modId))) {
    throw new ValidationError("idTaken");
  }
  const data = customModSchema.parse({ modId: input.modId, name: input.name });
  const { sha } = await storage.writeFile(
    paths.customModFile(data.modId),
    encodeDocument(customModSchema, data),
    null,
    `data: create custom mod ${data.modId}`,
  );
  return { data, sha };
}

export async function renameCustomMod(
  storage: StorageBackend,
  modId: string,
  name: string,
  expectedSha: string,
): Promise<Versioned<CustomMod>> {
  const current = await getCustomMod(storage, modId);
  if (!current) throw new NotFoundError(`custom mod ${modId}`);
  const data = customModSchema.parse({ ...current.data, name });
  const { sha } = await storage.writeFile(
    paths.customModFile(modId),
    encodeDocument(customModSchema, data),
    expectedSha,
    `data: rename custom mod ${modId}`,
  );
  return { data, sha };
}

/** Modpacks whose `customModIds` contain this custom mod. */
export async function packsReferencingCustomMod(
  storage: StorageBackend,
  modId: string,
) {
  return (await listModpacks(storage)).filter((p) =>
    p.data.customModIds.includes(modId),
  );
}

/**
 * Deletes the custom mod's data and icons and removes it from every modpack,
 * in one atomic commit (ADR 0015).
 */
export async function deleteCustomMod(
  storage: StorageBackend,
  modId: string,
  expectedSha: string,
): Promise<void> {
  if (!isModId(modId)) throw new NotFoundError(`custom mod ${modId}`);
  const [dataFiles, iconFiles, packs] = await Promise.all([
    storage.listFilesRecursive(paths.customModDir(modId)),
    storage.listFilesRecursive(paths.customModIconsDir(modId)),
    packsReferencingCustomMod(storage, modId),
  ]);
  if (!dataFiles.some((f) => f.path === paths.customModFile(modId))) {
    throw new NotFoundError(`custom mod ${modId}`);
  }

  const changes: FileChange[] = [...dataFiles, ...iconFiles].map((f) => ({
    path: f.path,
    content: null,
  }));
  // Every listed file must be unchanged at commit time, so nothing edited
  // concurrently is deleted unseen.
  const expected: Record<string, string | null> = Object.fromEntries(
    [...dataFiles, ...iconFiles].map((f) => [f.path, f.sha]),
  );
  expected[paths.customModFile(modId)] = expectedSha;
  for (const pack of packs) {
    const path = paths.modpackFile(pack.data.id);
    changes.push({
      path,
      content: encodeDocument(modpackSchema, {
        ...pack.data,
        customModIds: pack.data.customModIds.filter((id) => id !== modId),
      }),
    });
    expected[path] = pack.sha;
  }
  await storage.commit({
    message: `data: delete custom mod ${modId}`,
    changes,
    expected,
  });
}

async function writeMod(
  storage: StorageBackend,
  data: CustomMod,
  expectedSha: string,
  message: string,
): Promise<Versioned<CustomMod>> {
  const { sha } = await storage.writeFile(
    paths.customModFile(data.modId),
    encodeDocument(customModSchema, data),
    expectedSha,
    message,
  );
  return { data: customModSchema.parse(data), sha };
}

async function requireCustomMod(storage: StorageBackend, modId: string) {
  const current = await getCustomMod(storage, modId);
  if (!current) throw new NotFoundError(`custom mod ${modId}`);
  return current;
}

/** Sets the library mods this custom mod depends on; every ID must exist. */
export async function setCustomModDependencies(
  storage: StorageBackend,
  modId: string,
  dependencies: string[],
  expectedSha: string,
): Promise<Versioned<CustomMod>> {
  const current = await requireCustomMod(storage, modId);
  const metas = await loadLibraryMetas(storage);
  const unique = [...new Set(dependencies)].sort();
  if (unique.some((id) => !metas.has(id))) {
    throw new ValidationError("unknownMod");
  }
  return writeMod(
    storage,
    { ...current.data, dependencies: unique },
    expectedSha,
    `data: update dependencies of custom mod ${modId}`,
  );
}

/**
 * Sets the mod's current phase (spec 05). Open generated tasks of the old
 * phase disappear (their in-progress state is pruned in the same commit);
 * done tasks are kept.
 */
export async function setCustomModPhase(
  storage: StorageBackend,
  modId: string,
  phase: ProjectPhase,
  expectedSha: string,
): Promise<Versioned<CustomMod>> {
  const current = await requireCustomMod(storage, modId);
  const data = customModSchema.parse({ ...current.data, phase });
  const entries = await listEntries(storage, modId);
  const prune = await pruneTasksChange(
    storage,
    modId,
    entries.map((e) => summarizeEntry(e.data)),
    phase,
  );
  const file = paths.customModFile(modId);
  const content = encodeDocument(customModSchema, data);
  const changes: FileChange[] = [{ path: file, content }];
  const expected: Record<string, string | null> = { [file]: expectedSha };
  if (prune.change) changes.push(prune.change);
  expected[prune.path] = prune.sha;
  await storage.commit({
    message: `data: set phase of custom mod ${modId} to ${phase}`,
    changes,
    expected,
  });
  return { data, sha: gitBlobSha(content) };
}

/** The machine must be a block or multiblock entry of the same mod. */
async function checkMachine(
  storage: StorageBackend,
  modId: string,
  type: CustomRecipeType,
) {
  const { modId: machineMod, path } = splitEntryId(type.machine);
  const machine =
    machineMod === modId ? await getEntry(storage, modId, path) : null;
  if (
    !machine ||
    (machine.data.type !== "block" && machine.data.type !== "multiblock")
  ) {
    throw new ValidationError("invalidMachine");
  }
}

export async function createRecipeType(
  storage: StorageBackend,
  modId: string,
  input: unknown,
  expectedSha: string,
): Promise<Versioned<CustomMod>> {
  const current = await requireCustomMod(storage, modId);
  const type = customRecipeTypeSchema.parse(input);
  if (current.data.recipeTypes.some((t) => t.id === type.id)) {
    throw new ValidationError("idTaken");
  }
  await checkMachine(storage, modId, type);
  return writeMod(
    storage,
    { ...current.data, recipeTypes: [...current.data.recipeTypes, type] },
    expectedSha,
    `data: add recipe type ${modId}/${type.id}`,
  );
}

/**
 * Replaces a recipe type (same ID). Recipes of the type that no longer
 * match are flagged in the entry form and must be fixed before that entry
 * can be saved again.
 */
export async function updateRecipeType(
  storage: StorageBackend,
  modId: string,
  typeId: string,
  input: unknown,
  expectedSha: string,
): Promise<Versioned<CustomMod>> {
  const current = await requireCustomMod(storage, modId);
  const type = customRecipeTypeSchema.parse(input);
  if (type.id !== typeId) throw new ValidationError("invalidId");
  if (!current.data.recipeTypes.some((t) => t.id === typeId)) {
    throw new NotFoundError(`recipe type ${typeId}`);
  }
  await checkMachine(storage, modId, type);
  return writeMod(
    storage,
    {
      ...current.data,
      recipeTypes: current.data.recipeTypes.map((t) =>
        t.id === typeId ? type : t,
      ),
    },
    expectedSha,
    `data: update recipe type ${modId}/${typeId}`,
  );
}

/** Removes a recipe type; recipes and multiblocks using it show it as missing. */
export async function deleteRecipeType(
  storage: StorageBackend,
  modId: string,
  typeId: string,
  expectedSha: string,
): Promise<Versioned<CustomMod>> {
  const current = await requireCustomMod(storage, modId);
  if (!current.data.recipeTypes.some((t) => t.id === typeId)) {
    throw new NotFoundError(`recipe type ${typeId}`);
  }
  return writeMod(
    storage,
    {
      ...current.data,
      recipeTypes: current.data.recipeTypes.filter((t) => t.id !== typeId),
    },
    expectedSha,
    `data: delete recipe type ${modId}/${typeId}`,
  );
}
