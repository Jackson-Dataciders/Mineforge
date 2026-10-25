import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  itemTagsSchema,
  libraryItemsSchema,
  libraryMetaSchema,
  libraryRecipesSchema,
  TARGET_MINECRAFT_VERSION,
  type LibraryItem,
  type LibraryRecipe,
} from "../../src/domain/library";
import { compareCodeUnits, stableStringify } from "../../src/lib/stable-json";
import type { Extraction } from "./extract";
import { ExtractError } from "./metadata";

export type WriteSummary = {
  dataDir: string;
  items: number;
  inferredItems: number;
  recipes: number;
  inferredRecipes: number;
  tags: number;
  iconsMissing: number;
  iconFallbacks: number;
  filesChanged: number;
};

/** Repo-relative data folder for an extraction. */
export function dataDirFor(extraction: Extraction): string {
  return extraction.kind === "vanilla"
    ? `data/vanilla/${TARGET_MINECRAFT_VERSION}`
    : `data/library/${extraction.meta!.modId}`;
}

type Schema<T> = {
  safeParse: (v: unknown) => { success: boolean; data?: T };
};

/** Reads and validates an existing data file; aborts the run if it is invalid. */
function readExisting<T>(file: string, schema: Schema<T>): T | undefined {
  if (!existsSync(file)) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new ExtractError(`${file} is not valid JSON; fix or delete it first`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ExtractError(
      `${file} does not match the library schema; fix or delete it first`,
    );
  }
  return parsed.data as T;
}

/** Extracted records replace everything except inferred records with IDs not extracted now. */
function mergeInferred<T extends { id: string; source: string }>(
  extracted: T[],
  existing: T[] = [],
): T[] {
  const ids = new Set(extracted.map((r) => r.id));
  const kept = existing.filter(
    (r) => r.source === "inferred" && !ids.has(r.id),
  );
  return [...extracted, ...kept].sort((a, b) => compareCodeUnits(a.id, b.id));
}

/** Writes only when the content differs, so re-runs leave files untouched. */
function writeIfChanged(file: string, content: Uint8Array | string): boolean {
  const bytes =
    typeof content === "string"
      ? Buffer.from(content, "utf8")
      : Buffer.from(content);
  if (existsSync(file) && Buffer.compare(readFileSync(file), bytes) === 0)
    return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
  return true;
}

/** Writes the extraction into `repoRoot` (data files and icon PNGs). */
export function writeExtraction(
  extraction: Extraction,
  repoRoot: string,
): WriteSummary {
  const dataDir = dataDirFor(extraction);
  const root = path.resolve(repoRoot);
  /** Absolute path that must stay inside `<root>/<base>`, whatever the jar contains. */
  const inside = (base: string, rel: string) => {
    const allowed = path.join(root, base);
    const target = path.resolve(root, rel);
    if (!target.startsWith(allowed + path.sep)) {
      throw new ExtractError(`Refusing to write outside ${base}/: ${rel}`);
    }
    return target;
  };
  const dataFile = (name: string) => inside(dataDir, `${dataDir}/${name}`);

  // Validate everything that exists before writing anything.
  readExisting(dataFile("meta.json"), libraryMetaSchema);
  readExisting(dataFile("tags.json"), itemTagsSchema);
  const items = mergeInferred<LibraryItem>(
    extraction.items,
    readExisting(dataFile("items.json"), libraryItemsSchema),
  );
  const recipes = mergeInferred<LibraryRecipe>(
    extraction.recipes,
    readExisting(dataFile("recipes.json"), libraryRecipesSchema),
  );
  const textures = [...extraction.textures]
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([iconPath, png]) => ({
      file: inside("assets/textures", `assets/textures/${iconPath}`),
      png,
    }));

  let filesChanged = 0;
  const write = (file: string, content: Uint8Array | string) => {
    if (writeIfChanged(file, content)) filesChanged += 1;
  };
  if (extraction.meta) {
    write(dataFile("meta.json"), stableStringify(extraction.meta));
  }
  write(dataFile("items.json"), stableStringify(items));
  write(dataFile("recipes.json"), stableStringify(recipes));
  write(dataFile("tags.json"), stableStringify(extraction.tags));
  for (const { file, png } of textures) write(file, png);

  return {
    dataDir,
    items: items.length,
    inferredItems: items.filter((i) => i.source === "inferred").length,
    recipes: recipes.length,
    inferredRecipes: recipes.filter((r) => r.source === "inferred").length,
    tags: Object.keys(extraction.tags).length,
    iconsMissing: items.filter((i) => i.icon === null).length,
    iconFallbacks: items.filter((i) => i.iconFallback).length,
    filesChanged,
  };
}
