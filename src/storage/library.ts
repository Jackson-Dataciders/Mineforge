import type { z } from "zod";
import { VANILLA_MOD_NAME, type ItemSource } from "@/domain/item-sources";
import {
  itemTagsSchema,
  libraryItemsSchema,
  libraryMetaSchema,
  libraryRecipesSchema,
  type LibraryMeta,
} from "@/domain/library";
import { decodeJson } from "@/lib/stable-json";
import { paths, type LibraryFileName } from "./paths";
import type { StorageBackend } from "./types";

/**
 * Read access to library and vanilla data (written only by the import,
 * ADR 0006). Parsed files are cached in memory by path and blob SHA, so a
 * warm server instance re-reads only files that changed.
 */

const CACHE_LIMIT = 64;
const parsedCache = new Map<string, unknown>();

function remember(key: string, value: unknown) {
  parsedCache.delete(key);
  parsedCache.set(key, value);
  while (parsedCache.size > CACHE_LIMIT) {
    parsedCache.delete(parsedCache.keys().next().value!);
  }
}

/** Blob SHAs of all library and vanilla files (two listing calls). */
async function dataIndex(
  storage: StorageBackend,
): Promise<Map<string, string>> {
  const [library, vanilla] = await Promise.all([
    storage.listFilesRecursive(paths.libraryDir),
    storage.listDir(paths.vanillaDir),
  ]);
  return new Map([
    ...library.map((f) => [f.path, f.sha] as const),
    ...vanilla
      .filter((e) => e.type === "file")
      .map((e) => [e.path, e.sha] as const),
  ]);
}

async function readCached<S extends z.ZodType>(
  storage: StorageBackend,
  index: Map<string, string>,
  path: string,
  schema: S,
): Promise<z.output<S> | null> {
  const sha = index.get(path);
  if (!sha) return null;
  const key = `${path}@${sha}`;
  if (parsedCache.has(key)) {
    const value = parsedCache.get(key) as z.output<S>;
    remember(key, value);
    return value;
  }
  const file = await storage.readFile(path);
  if (!file) return null;
  const parsed = schema.safeParse(decodeJson(file.content));
  if (!parsed.success) {
    throw new Error(`Invalid data in ${path}: ${parsed.error.message}`);
  }
  remember(`${path}@${file.sha}`, parsed.data);
  return parsed.data;
}

/** Library mod folder IDs that have a `meta.json`. */
function libraryModIds(index: Map<string, string>): string[] {
  const ids: string[] = [];
  for (const path of index.keys()) {
    const match = /^data\/library\/([^/]+)\/meta\.json$/.exec(path);
    if (match) ids.push(match[1]!);
  }
  return ids;
}

const modFile = (modId: string, file: LibraryFileName) =>
  paths.libraryFile(modId, file);

export type LibraryModSummary = {
  meta: LibraryMeta;
  itemCount: number;
  inferredItemCount: number;
  recipeCount: number;
  inferredRecipeCount: number;
};

export type LibraryOverview = {
  mods: LibraryModSummary[];
  /** Jar file names in `jars/mods/` that no `meta.json` references. */
  pendingJars: string[];
  /** All jar file names in `jars/mods/`. */
  jarNames: string[];
  hasVanillaData: boolean;
};

export async function loadLibraryOverview(
  storage: StorageBackend,
): Promise<LibraryOverview> {
  const [index, jarEntries] = await Promise.all([
    dataIndex(storage),
    storage.listDir(paths.modJarsDir),
  ]);
  const mods = (
    await Promise.all(
      libraryModIds(index).map(async (modId) => {
        const [meta, items, recipes] = await Promise.all([
          readCached(
            storage,
            index,
            modFile(modId, "meta.json"),
            libraryMetaSchema,
          ),
          readCached(
            storage,
            index,
            modFile(modId, "items.json"),
            libraryItemsSchema,
          ),
          readCached(
            storage,
            index,
            modFile(modId, "recipes.json"),
            libraryRecipesSchema,
          ),
        ]);
        if (!meta) return null;
        return {
          meta,
          itemCount: items?.length ?? 0,
          inferredItemCount:
            items?.filter((i) => i.source === "inferred").length ?? 0,
          recipeCount: recipes?.length ?? 0,
          inferredRecipeCount:
            recipes?.filter((r) => r.source === "inferred").length ?? 0,
        };
      }),
    )
  )
    .filter((m): m is LibraryModSummary => m !== null)
    .sort((a, b) => a.meta.name.localeCompare(b.meta.name, "en"));

  const referenced = new Set(mods.map((m) => m.meta.jarFile));
  const jarNames = jarEntries
    .filter((e) => e.type === "file" && e.name.toLowerCase().endsWith(".jar"))
    .map((e) => e.name);
  return {
    mods,
    jarNames,
    pendingJars: jarNames.filter(
      (name) => !referenced.has(`${paths.modJarsDir}/${name}`),
    ),
    hasVanillaData: index.has(paths.vanillaFile("items.json")),
  };
}

/** Metas of all library mods, by folder ID. */
export async function loadLibraryMetas(
  storage: StorageBackend,
): Promise<Map<string, LibraryMeta>> {
  const index = await dataIndex(storage);
  const entries = await Promise.all(
    libraryModIds(index).map(
      async (modId) =>
        [
          modId,
          await readCached(
            storage,
            index,
            modFile(modId, "meta.json"),
            libraryMetaSchema,
          ),
        ] as const,
    ),
  );
  return new Map(
    entries.filter((e): e is readonly [string, LibraryMeta] => e[1] !== null),
  );
}

/**
 * Vanilla plus the given library mods as item sources, vanilla first, then
 * mods in the given order. Unknown mod IDs are skipped.
 */
export async function loadItemSources(
  storage: StorageBackend,
  libraryModIds: readonly string[],
): Promise<ItemSource[]> {
  const index = await dataIndex(storage);
  const load = async (modId: string | null): Promise<ItemSource | null> => {
    const file = (name: Exclude<LibraryFileName, "meta.json">) =>
      modId === null ? paths.vanillaFile(name) : modFile(modId, name);
    const meta =
      modId === null
        ? null
        : await readCached(
            storage,
            index,
            modFile(modId, "meta.json"),
            libraryMetaSchema,
          );
    if (modId !== null && !meta) return null;
    const [items, recipes, tags] = await Promise.all([
      readCached(storage, index, file("items.json"), libraryItemsSchema),
      readCached(storage, index, file("recipes.json"), libraryRecipesSchema),
      readCached(storage, index, file("tags.json"), itemTagsSchema),
    ]);
    if (modId === null && !items) return null;
    return {
      modId,
      modName: meta?.name ?? VANILLA_MOD_NAME,
      items: items ?? [],
      recipes: recipes ?? [],
      tags: tags ?? {},
    };
  };
  const sources = await Promise.all([null, ...libraryModIds].map(load));
  return sources.filter((s): s is ItemSource => s !== null);
}
