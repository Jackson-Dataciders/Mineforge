import { readJson, type JarFiles } from "./zip";

const MAX_DEPTH = 16;
/** Block faces tried, in order, when a block item has no `layer0`. */
const FALLBACK_KEYS = [
  "all",
  "side",
  "front",
  "top",
  "end",
  "texture",
  "particle",
];

/** `stone` → `minecraft:stone`; namespaced IDs stay as they are. */
export const withNamespace = (id: string) =>
  id.includes(":") ? id : `minecraft:${id}`;

const splitId = (id: string) => {
  const [ns, ...rest] = withNamespace(id).split(":");
  return { ns: ns!, path: rest.join(":") };
};

type ModelJson = { parent?: unknown; textures?: unknown };

function loadModel(files: JarFiles, id: string): ModelJson | undefined {
  const { ns, path } = splitId(id);
  const model = readJson(files, `assets/${ns}/models/${path}.json`);
  return typeof model === "object" && model !== null
    ? (model as ModelJson)
    : undefined;
}

function textureValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "sprite" in value) {
    const sprite = (value as { sprite: unknown }).sprite;
    return typeof sprite === "string" ? sprite : undefined;
  }
  return undefined;
}

export type IconResolution = { texture: string | null; fallback: boolean };

/**
 * Resolves an item's icon texture from `assets/<ns>/models/item/<path>.json`:
 * follows `parent` inside the jar, merges textures child-over-parent and
 * resolves `#var` references. `layer0` wins; otherwise block items fall back
 * to a representative block face. `builtin/entity` items have no icon.
 */
export function resolveItemIcon(
  files: JarFiles,
  ns: string,
  path: string,
): IconResolution {
  const textures: Record<string, string> = {};
  let current: string | undefined = `${ns}:item/${path}`;
  let isBlockModel = false;
  const visited = new Set<string>();

  for (let depth = 0; current && depth < MAX_DEPTH; depth++) {
    const id = withNamespace(current);
    if (visited.has(id) || id === "minecraft:builtin/generated") break;
    if (id === "minecraft:builtin/entity")
      return { texture: null, fallback: false };
    visited.add(id);
    if (splitId(id).path.startsWith("block/")) isBlockModel = true;

    const model = loadModel(files, id);
    if (!model) break;
    if (typeof model.textures === "object" && model.textures !== null) {
      for (const [key, value] of Object.entries(model.textures)) {
        const resolved = textureValue(value);
        if (resolved !== undefined && !(key in textures))
          textures[key] = resolved;
      }
    }
    current = typeof model.parent === "string" ? model.parent : undefined;
  }

  const resolve = (key: string): string | undefined => {
    let value = textures[key];
    for (let hops = 0; value?.startsWith("#") && hops < 8; hops++) {
      value = textures[value.slice(1)];
    }
    return value && !value.startsWith("#") ? withNamespace(value) : undefined;
  };

  const layer0 = resolve("layer0");
  if (layer0) return { texture: layer0, fallback: false };
  if (isBlockModel) {
    for (const key of FALLBACK_KEYS) {
      const face = resolve(key);
      if (face) return { texture: face, fallback: true };
    }
  }
  return { texture: null, fallback: false };
}

/** Jar path of a texture ID, e.g. `minecraft:item/diamond` → `assets/minecraft/textures/item/diamond.png`. */
export function texturePath(texture: string): {
  jarPath: string;
  iconPath: string;
} {
  const { ns, path } = splitId(texture);
  return {
    jarPath: `assets/${ns}/textures/${path}.png`,
    iconPath: `${ns}/${path}.png`,
  };
}
