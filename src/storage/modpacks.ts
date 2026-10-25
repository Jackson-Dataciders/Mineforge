import { isPackId } from "@/domain/ids";
import { modpackSchema, type Modpack } from "@/domain/modpack";
import { encodeDocument, readDocument, type Versioned } from "./documents";
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
