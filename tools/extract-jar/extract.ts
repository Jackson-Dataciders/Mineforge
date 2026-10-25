import { createHash } from "node:crypto";
import {
  isIconPath,
  libraryMetaSchema,
  resourceIdSchema,
  tagValueSchema,
  type ItemTags,
  type LibraryItem,
  type LibraryMeta,
  type LibraryRecipe,
} from "../../src/domain/library";
import { compareCodeUnits } from "../../src/lib/stable-json";
import { ExtractError, readMetadata } from "./metadata";
import { resolveItemIcon, texturePath } from "./models";
import { readJar, readJarEntry, readJson, type JarFiles } from "./zip";

export type Extraction = {
  kind: "vanilla" | "mod";
  /** Only for mod jars. */
  meta: LibraryMeta | null;
  items: LibraryItem[];
  recipes: LibraryRecipe[];
  tags: ItemTags;
  /** PNGs to copy, by path under `assets/textures/`. */
  textures: Map<string, Uint8Array>;
  warnings: string[];
};

export type ExtractOptions = {
  /** Repo-relative jar path recorded in meta.json. */
  jarFile: string;
  /** Whether `assets/textures/<iconPath>` already exists in the repo (e.g. from the vanilla import). */
  textureExists: (iconPath: string) => boolean;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function extractItems(
  files: JarFiles,
  namespaces: string[],
  options: ExtractOptions,
  textures: Map<string, Uint8Array>,
  warnings: string[],
): LibraryItem[] {
  const items = new Map<string, LibraryItem>();
  for (const ns of namespaces) {
    const lang = readJson(files, `assets/${ns}/lang/en_us.json`);
    if (!isObject(lang)) continue;
    // item.* names win over block.* names for the same ID.
    const keys = Object.keys(lang).sort(
      (a, b) =>
        (a.startsWith("item.") ? 1 : 0) - (b.startsWith("item.") ? 1 : 0),
    );
    for (const key of keys) {
      const parts = key.split(".");
      if (parts.length !== 3) continue;
      const [prefix, keyNs, path] = parts as [string, string, string];
      if (
        (prefix !== "item" && prefix !== "block") ||
        !namespaces.includes(keyNs)
      )
        continue;
      const name = lang[key];
      if (typeof name !== "string") continue;
      // Every real 1.21.1 item has an item model; keys without one are blocks
      // without an item form (water) or stale lang entries (pottery_shard_*).
      if (!files.has(`assets/${keyNs}/models/item/${path}.json`)) continue;

      const id = `${keyNs}:${path}`;
      if (!resourceIdSchema.safeParse(id).success) {
        warnings.push(`Skipped item with invalid ID ${id}`);
        continue;
      }

      let icon: string | null = null;
      const resolved = resolveItemIcon(files, keyNs, path);
      if (resolved.texture) {
        const { jarPath, iconPath } = texturePath(resolved.texture);
        const png = files.get(jarPath);
        if (!isIconPath(iconPath)) {
          warnings.push(
            `No icon for ${id}: texture path ${iconPath} is not valid`,
          );
        } else if (png && namespaces.includes(iconPath.split("/")[0]!)) {
          // Only textures in the jar's own namespaces are copied, so a mod
          // never overwrites vanilla or other mods' textures.
          icon = iconPath;
          textures.set(iconPath, png);
        } else if (options.textureExists(iconPath)) {
          icon = iconPath;
        }
      }
      const fallback = icon !== null && resolved.fallback;
      items.set(id, {
        id,
        name,
        icon,
        source: "extracted",
        ...(fallback ? { iconFallback: true as const } : {}),
      });
    }
  }
  return [...items.values()].sort((a, b) => compareCodeUnits(a.id, b.id));
}

function extractRecipes(files: JarFiles, warnings: string[]): LibraryRecipe[] {
  const recipes: LibraryRecipe[] = [];
  for (const path of files.keys()) {
    const match = /^data\/([^/]+)\/recipe\/(.+)\.json$/.exec(path);
    if (!match) continue;
    const id = `${match[1]}:${match[2]}`;
    const data = readJson(files, path);
    if (
      !resourceIdSchema.safeParse(id).success ||
      !isObject(data) ||
      typeof data.type !== "string"
    ) {
      warnings.push(`Skipped unreadable recipe ${path}`);
      continue;
    }
    recipes.push({ id, type: data.type, source: "extracted", data });
  }
  return recipes.sort((a, b) => compareCodeUnits(a.id, b.id));
}

function extractTags(files: JarFiles, warnings: string[]): ItemTags {
  const tags: ItemTags = {};
  const paths = [...files.keys()]
    .filter((p) => /^data\/[^/]+\/tags\/item\/.+\.json$/.test(p))
    .sort(compareCodeUnits);
  for (const path of paths) {
    const [, ns, tagPath] = /^data\/([^/]+)\/tags\/item\/(.+)\.json$/.exec(
      path,
    )!;
    const id = `${ns}:${tagPath}`;
    const data = readJson(files, path);
    if (!resourceIdSchema.safeParse(id).success || !isObject(data)) {
      warnings.push(`Skipped unreadable tag ${path}`);
      continue;
    }
    const values: ItemTags[string]["values"] = [];
    for (const raw of Array.isArray(data.values) ? data.values : []) {
      const value = isObject(raw)
        ? typeof raw.id === "string"
          ? { id: raw.id, required: raw.required !== false }
          : undefined
        : raw;
      const parsed = tagValueSchema.safeParse(value);
      if (parsed.success) values.push(parsed.data);
      else warnings.push(`Dropped an invalid value in tag ${id}`);
    }
    tags[id] = { replace: data.replace === true, values };
  }
  return tags;
}

/**
 * Copies the declared mod logo to `assets/textures/<modid>/_logo.png`
 * (ADR 0019). Only a `.png` that exists in the jar is used.
 */
function extractLogo(
  bytes: Uint8Array,
  modId: string,
  logoFile: string | null,
  textures: Map<string, Uint8Array>,
  warnings: string[],
): string | null {
  if (!logoFile) return null;
  const path = logoFile.replace(/^\.?\/+/, "");
  if (!/\.png$/i.test(path)) {
    warnings.push(`Logo ${logoFile} is not a PNG; no logo`);
    return null;
  }
  const png = readJarEntry(bytes, path);
  if (!png) {
    warnings.push(`Logo ${logoFile} is missing from the jar; no logo`);
    return null;
  }
  const iconPath = `${modId}/_logo.png`;
  textures.set(iconPath, png);
  return iconPath;
}

/**
 * Turns a mod jar or the vanilla 1.21.1 client jar into library data
 * (spec docs/specs/02-jar-extraction.md). Pure apart from hashing: the caller
 * writes the result.
 */
export function extractJar(
  bytes: Uint8Array,
  options: ExtractOptions,
): Extraction {
  const { files, legacyEntries } = readJar(bytes);
  const kind = readMetadata(files);
  const warnings: string[] = [];
  if (legacyEntries > 0) {
    warnings.push(
      `${legacyEntries} files in pre-1.21 folders (recipes/, tags/items/) were ignored`,
    );
  }

  let meta: LibraryMeta | null = null;
  const textures = new Map<string, Uint8Array>();
  if (kind.kind === "mod") {
    // Validated before anything is written: modId becomes a folder name.
    const parsed = libraryMetaSchema.safeParse({
      ...kind.meta,
      jarFile: options.jarFile,
      jarSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      );
      throw new ExtractError(`Invalid mod metadata (${issues.join("; ")})`);
    }
    meta = parsed.data;
    meta.logo = extractLogo(
      bytes,
      meta.modId,
      kind.logoFile,
      textures,
      warnings,
    );
  }

  const namespaces = meta
    ? meta.modIds.filter((id) => id !== "minecraft")
    : ["minecraft"];
  return {
    kind: kind.kind,
    meta,
    items: extractItems(files, namespaces, options, textures, warnings),
    recipes: extractRecipes(files, warnings),
    tags: extractTags(files, warnings),
    textures,
    warnings,
  };
}
