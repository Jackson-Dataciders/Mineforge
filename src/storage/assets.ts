import type { StorageBackend } from "./types";

/** `texture`: extracted, under `assets/textures/`. `icon`: drawn, under `assets/icons/`. */
export type AssetKind = "texture" | "icon";

const SEGMENT = /^[a-z0-9_.-]+$/;
const ROOT: Record<AssetKind, string> = {
  texture: "assets/textures",
  icon: "assets/icons",
};

/**
 * Validates the URL segments of `/api/textures/...` or `/api/icons/...` and
 * returns the repo path, or `null` for anything that isn't a plain PNG path.
 */
export function resolveAssetPath(
  kind: AssetKind,
  segments: readonly string[],
): string | null {
  if (segments.length < 2) return null;
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment === "." || segment === "..")
      return null;
  }
  if (!segments.at(-1)?.endsWith(".png")) return null;
  return `${ROOT[kind]}/${segments.join("/")}`;
}

/** URL for an asset; the inverse of `resolveAssetPath`. */
export function assetUrl(kind: AssetKind, relativePath: string): string {
  return `/api/${kind === "texture" ? "textures" : "icons"}/${relativePath}`;
}

export function readAsset(storage: StorageBackend, path: string) {
  return storage.readFile(path);
}
