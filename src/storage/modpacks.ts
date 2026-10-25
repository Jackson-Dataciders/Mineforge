import { isPackId } from "@/domain/ids";
import { modpackSchema, type Modpack } from "@/domain/modpack";
import { compareCodeUnits } from "@/lib/stable-json";
import { encodeDocument, readDocument, type Versioned } from "./documents";
import { loadLibraryMetas } from "./library";
import { paths } from "./paths";
import { NotFoundError, ValidationError, type StorageBackend } from "./types";

export async function listModpacks(
  storage: StorageBackend,
): Promise<Versioned<Modpack>[]> {
  const dirs = (await storage.listDir(paths.modpacksDir)).filter(
    (e) => e.type === "dir" && isPackId(e.name),
  );
  const packs = await Promise.all(
    dirs.map((d) =>
      readDocument(storage, paths.modpackFile(d.name), modpackSchema),
    ),
  );
  return packs
    .filter((p): p is Versioned<Modpack> => p !== null)
    .sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export function getModpack(storage: StorageBackend, packId: string) {
  if (!isPackId(packId)) return Promise.resolve(null);
  return readDocument(storage, paths.modpackFile(packId), modpackSchema);
}

export async function createModpack(
  storage: StorageBackend,
  input: { id: string; name: string },
): Promise<Versioned<Modpack>> {
  if (!isPackId(input.id)) throw new ValidationError("invalidId");
  if (await storage.readFile(paths.modpackFile(input.id))) {
    throw new ValidationError("idTaken");
  }
  const data = modpackSchema.parse({ id: input.id, name: input.name });
  const { sha } = await storage.writeFile(
    paths.modpackFile(data.id),
    encodeDocument(modpackSchema, data),
    null,
    `data: create modpack ${data.id}`,
  );
  return { data, sha };
}

export async function renameModpack(
  storage: StorageBackend,
  packId: string,
  name: string,
  expectedSha: string,
): Promise<Versioned<Modpack>> {
  const current = await getModpack(storage, packId);
  if (!current) throw new NotFoundError(`modpack ${packId}`);
  const data = modpackSchema.parse({ ...current.data, name });
  const { sha } = await storage.writeFile(
    paths.modpackFile(packId),
    encodeDocument(modpackSchema, data),
    expectedSha,
    `data: rename modpack ${packId}`,
  );
  return { data, sha };
}

/** Deletes every file of the modpack in one atomic commit. */
export async function deleteModpack(
  storage: StorageBackend,
  packId: string,
  expectedSha: string,
): Promise<void> {
  if (!isPackId(packId)) throw new NotFoundError(`modpack ${packId}`);
  const files = await storage.listFilesRecursive(paths.modpackDir(packId));
  if (!files.some((f) => f.path === paths.modpackFile(packId))) {
    throw new NotFoundError(`modpack ${packId}`);
  }
  await storage.commit({
    message: `data: delete modpack ${packId}`,
    changes: files.map((f) => ({ path: f.path, content: null })),
    expected: {
      ...Object.fromEntries(files.map((f) => [f.path, f.sha])),
      [paths.modpackFile(packId)]: expectedSha,
    },
  });
}

/**
 * Replaces the pack's library mod and custom mod references. Every ID must
 * exist: library mods by folder (with a `meta.json`), custom mods by folder.
 */
export async function setModpackMods(
  storage: StorageBackend,
  packId: string,
  mods: { libraryModIds: string[]; customModIds: string[] },
  expectedSha: string,
): Promise<Versioned<Modpack>> {
  const current = await getModpack(storage, packId);
  if (!current) throw new NotFoundError(`modpack ${packId}`);
  const [libraryMetas, customDirs] = await Promise.all([
    loadLibraryMetas(storage),
    storage.listDir(paths.customModsDir),
  ]);
  const customIds = new Set(
    customDirs.filter((e) => e.type === "dir").map((e) => e.name),
  );
  const unique = (ids: string[]) => [...new Set(ids)].sort(compareCodeUnits);
  const libraryModIds = unique(mods.libraryModIds);
  const customModIds = unique(mods.customModIds);
  if (
    libraryModIds.some((id) => !libraryMetas.has(id)) ||
    customModIds.some((id) => !customIds.has(id))
  ) {
    throw new ValidationError("unknownMod");
  }
  const data = modpackSchema.parse({
    ...current.data,
    libraryModIds,
    customModIds,
  });
  const { sha } = await storage.writeFile(
    paths.modpackFile(packId),
    encodeDocument(modpackSchema, data),
    expectedSha,
    `data: update mods of modpack ${packId}`,
  );
  return { data, sha };
}
