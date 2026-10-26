import { customModSchema, type CustomMod } from "@/domain/custom-mod";
import { customRecipeProblem } from "@/domain/custom-recipe";
import {
  entrySchema,
  isItemEntry,
  linkedEntryIds,
  usedRecipeTypes,
  withoutRelationsTo,
  type Entry,
} from "@/domain/entry";
import { isEntryPath, splitEntryId } from "@/domain/entry-id";
import { isModId } from "@/domain/ids";
import { isIconPng } from "@/domain/pixel-image";
import { compareCodeUnits, stableStringify } from "@/lib/stable-json";
import { readCached } from "./cached";
import { encodeDocument, readDocument, type Versioned } from "./documents";
import { gitBlobSha } from "./git-sha";
import { paths } from "./paths";
import {
  NotFoundError,
  ValidationError,
  type FileChange,
  type StorageBackend,
} from "./types";

/**
 * Custom mod entries, one file each (spec 04, ADR 0021). An entry and its
 * icon are written in one commit; deleting an entry also removes manual
 * relations to it from the mod's other entries, in the same commit.
 */

/** Icon change on save: new PNG bytes, `null` to remove, `undefined` to keep. */
export type IconUpdate = Uint8Array | null | undefined;

export async function listEntries(
  storage: StorageBackend,
  modId: string,
): Promise<Versioned<Entry>[]> {
  if (!isModId(modId)) return [];
  const files = (
    await storage.listFilesRecursive(paths.entriesDir(modId))
  ).filter((f) => {
    const name = f.path.slice(paths.entriesDir(modId).length + 1);
    return name.endsWith(".json") && isEntryPath(name.slice(0, -5));
  });
  const entries = await Promise.all(
    files.map(async (f) => {
      const data = await readCached(storage, f.path, f.sha, entrySchema);
      return data ? { data, sha: f.sha } : null;
    }),
  );
  return entries
    .filter((e): e is Versioned<Entry> => e !== null)
    .sort(
      (a, b) =>
        a.data.name.localeCompare(b.data.name, "en") ||
        compareCodeUnits(a.data.id, b.data.id),
    );
}

export function getEntry(
  storage: StorageBackend,
  modId: string,
  path: string,
): Promise<Versioned<Entry> | null> {
  if (!isModId(modId) || !isEntryPath(path)) return Promise.resolve(null);
  return readDocument(storage, paths.entryFile(modId, path), entrySchema);
}

async function requireMod(
  storage: StorageBackend,
  modId: string,
): Promise<Versioned<CustomMod>> {
  const mod = isModId(modId)
    ? await readDocument(storage, paths.customModFile(modId), customModSchema)
    : null;
  if (!mod) throw new NotFoundError(`custom mod ${modId}`);
  return mod;
}

/**
 * Checks what an entry links to. References the stored version already had
 * stay allowed, so an entry whose target was deleted can still be edited.
 */
function checkReferences(
  entry: Entry,
  previous: Entry | null,
  entryIds: ReadonlySet<string>,
  mod: CustomMod,
) {
  const known = new Set(previous ? linkedEntryIds(previous) : []);
  for (const target of linkedEntryIds(entry)) {
    if (target === entry.id) throw new ValidationError("unknownEntry");
    if (!entryIds.has(target) && !known.has(target)) {
      throw new ValidationError("unknownEntry");
    }
  }
  const types = new Map(mod.recipeTypes.map((t) => [t.id, t]));
  const knownTypes = new Set(previous ? usedRecipeTypes(previous) : []);
  if (entry.type === "multiblock") {
    for (const id of entry.recipeTypes) {
      if (!types.has(id) && !knownTypes.has(id)) {
        throw new ValidationError("unknownRecipeType");
      }
    }
  }
  if (!isItemEntry(entry)) return;
  const unchanged = new Set(
    previous && isItemEntry(previous)
      ? previous.recipes.map((r) => stableStringify(r))
      : [],
  );
  for (const recipe of entry.recipes) {
    if (recipe.type !== "custom") continue;
    const type = types.get(recipe.recipeType);
    if (!type) {
      // A recipe of a deleted type may stay as it was, shown as missing.
      if (unchanged.has(stableStringify(recipe))) continue;
      throw new ValidationError("unknownRecipeType");
    }
    // Like recipes of deleted types: an unchanged recipe whose type was edited
    // since may stay until the user edits it (the form flags it).
    if (
      customRecipeProblem(recipe, type) &&
      !unchanged.has(stableStringify(recipe))
    ) {
      throw new ValidationError("invalidRecipe");
    }
  }
}

function iconChange(
  modId: string,
  path: string,
  icon: IconUpdate,
): FileChange | null {
  if (icon === undefined) return null;
  if (icon !== null && !isIconPng(icon))
    throw new ValidationError("invalidIcon");
  return { path: paths.entryIconFile(modId, path), content: icon };
}

export async function createEntry(
  storage: StorageBackend,
  modId: string,
  input: unknown,
  icon: IconUpdate,
): Promise<Versioned<Entry>> {
  const mod = await requireMod(storage, modId);
  const parsed = entrySchema.parse(input);
  const { modId: idMod, path } = splitEntryId(parsed.id);
  if (idMod !== modId) throw new ValidationError("invalidId");
  const entries = await listEntries(storage, modId);
  if (entries.some((e) => e.data.id === parsed.id)) {
    throw new ValidationError("idTaken");
  }
  const data = entrySchema.parse({
    ...parsed,
    icon: icon instanceof Uint8Array,
  });
  checkReferences(data, null, new Set(entries.map((e) => e.data.id)), mod.data);

  const file = paths.entryFile(modId, path);
  const content = encodeDocument(entrySchema, data);
  const changes: FileChange[] = [{ path: file, content }];
  const iconFile = iconChange(modId, path, icon ?? undefined);
  if (iconFile) changes.push(iconFile);
  await storage.commit({
    message: `data: create entry ${data.id}`,
    changes,
    expected: { [file]: null },
  });
  return { data, sha: gitBlobSha(content) };
}

export async function updateEntry(
  storage: StorageBackend,
  modId: string,
  path: string,
  input: unknown,
  expectedSha: string,
  icon: IconUpdate,
): Promise<Versioned<Entry>> {
  const mod = await requireMod(storage, modId);
  const current = await getEntry(storage, modId, path);
  if (!current) throw new NotFoundError(`entry ${modId}:${path}`);
  const parsed = entrySchema.parse(input);
  // The ID never changes (ADR 0021).
  if (parsed.id !== current.data.id) throw new ValidationError("invalidId");
  const hasIcon = icon === undefined ? current.data.icon : icon !== null;
  const data = entrySchema.parse({ ...parsed, icon: hasIcon });
  const entries = await listEntries(storage, modId);
  checkReferences(
    data,
    current.data,
    new Set(entries.map((e) => e.data.id)),
    mod.data,
  );

  const file = paths.entryFile(modId, path);
  const content = encodeDocument(entrySchema, data);
  const changes: FileChange[] = [{ path: file, content }];
  // Remove an icon only if its file exists (the flag alone isn't proof).
  const removeIcon =
    icon === null &&
    !!(await storage.readFile(paths.entryIconFile(modId, path)));
  const iconFile = iconChange(
    modId,
    path,
    icon === null && !removeIcon ? undefined : icon,
  );
  if (iconFile) changes.push(iconFile);
  await storage.commit({
    message: `data: update entry ${data.id}`,
    changes,
    expected: { [file]: expectedSha },
  });
  return { data, sha: gitBlobSha(content) };
}

/**
 * Deletes an entry and its icon, and removes manual relations to it from
 * the mod's other entries, all in one commit (ADR 0021).
 */
export async function deleteEntry(
  storage: StorageBackend,
  modId: string,
  path: string,
  expectedSha: string,
): Promise<void> {
  const current = await getEntry(storage, modId, path);
  if (!current) throw new NotFoundError(`entry ${modId}:${path}`);
  const id = current.data.id;
  const entries = await listEntries(storage, modId);
  const file = paths.entryFile(modId, path);
  const changes: FileChange[] = [{ path: file, content: null }];
  const expected: Record<string, string | null> = { [file]: expectedSha };

  for (const other of entries) {
    if (other.data.id === id) continue;
    if (!other.data.relations.some((r) => r.target === id)) continue;
    const otherPath = paths.entryFile(modId, splitEntryId(other.data.id).path);
    changes.push({
      path: otherPath,
      content: encodeDocument(entrySchema, withoutRelationsTo(other.data, id)),
    });
    expected[otherPath] = other.sha;
  }
  if (current.data.icon) {
    const iconFile = paths.entryIconFile(modId, path);
    if (await storage.readFile(iconFile)) {
      changes.push({ path: iconFile, content: null });
    }
  }
  await storage.commit({
    message: `data: delete entry ${id}`,
    changes,
    expected,
  });
}
