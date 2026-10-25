import { customModSchema, type CustomMod } from "@/domain/custom-mod";
import { isModId } from "@/domain/ids";
import { modpackSchema } from "@/domain/modpack";
import { encodeDocument, readDocument, type Versioned } from "./documents";
import { listModpacks } from "./modpacks";
import { paths } from "./paths";
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
