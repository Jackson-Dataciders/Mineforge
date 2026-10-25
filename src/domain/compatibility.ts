import { TARGET_MINECRAFT_VERSION, type LibraryMeta } from "./library";

/**
 * Whether a library mod targets NeoForge 1.21.1 (ADR 0016). Computed, never
 * stored. Minecraft ranges in NeoForge/Forge metadata are Maven version
 * ranges.
 */

function tokens(version: string): (number | string)[] {
  return version
    .trim()
    .toLowerCase()
    .split(/[.\-+_]/)
    .filter((t) => t !== "")
    .map((t) => (/^\d+$/.test(t) ? Number(t) : t));
}

/**
 * Simplified Maven version order: numeric parts compare as numbers, missing
 * parts count as 0, and a qualifier (`pre1`, `rc1`) sorts below a release.
 */
export function compareVersions(a: string, b: string): number {
  const [ta, tb] = [tokens(a), tokens(b)];
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const [x, y] = [ta[i] ?? 0, tb[i] ?? 0];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x < y ? -1 : 1;
    if (typeof x === "number") return 1;
    if (typeof y === "number") return -1;
    return x < y ? -1 : 1;
  }
  return 0;
}

const RANGE = /([[(])([^[\]()]*)([\])])/g;

/**
 * Whether a Maven range contains a version. Supports `[a,b)`, `(,b]`,
 * `[a,)`, `[a]` and comma-separated unions. A bare version (`1.21.1`) or
 * `*` is a soft requirement and matches everything; so does a spec that
 * can't be parsed.
 */
export function mavenRangeContains(spec: string, version: string): boolean {
  const trimmed = spec.trim();
  if (!/[[(]/.test(trimmed)) return true;
  const ranges = [...trimmed.matchAll(RANGE)];
  if (ranges.length === 0) return true;
  return ranges.some(([, open, body, close]) => {
    const parts = body!.split(",").map((p) => p.trim());
    if (parts.length === 1) return compareVersions(version, parts[0]!) === 0;
    if (parts.length !== 2) return true;
    const [low, high] = parts as [string, string];
    if (low) {
      const c = compareVersions(version, low);
      if (c < 0 || (c === 0 && open === "(")) return false;
    }
    if (high) {
      const c = compareVersions(version, high);
      if (c > 0 || (c === 0 && close === ")")) return false;
    }
    return true;
  });
}

export type Compatibility =
  { compatible: true } | { compatible: false; reason: "loader" | "version" };

export function targetCompatibility(
  meta: Pick<LibraryMeta, "loader" | "minecraftVersionRange">,
): Compatibility {
  if (meta.loader !== "neoforge")
    return { compatible: false, reason: "loader" };
  if (
    meta.minecraftVersionRange !== null &&
    !mavenRangeContains(meta.minecraftVersionRange, TARGET_MINECRAFT_VERSION)
  ) {
    return { compatible: false, reason: "version" };
  }
  return { compatible: true };
}
