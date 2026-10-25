import { compareCodeUnits } from "@/lib/stable-json";
import type { LibraryMeta } from "./library";

/** Loader and platform IDs that are never missing mods (ADR 0016). */
export const IGNORED_DEPENDENCY_IDS: ReadonlySet<string> = new Set([
  "minecraft",
  "neoforge",
  "forge",
  "fabricloader",
  "java",
]);

export type MissingDependency = {
  /** The mod ID nobody in the pack provides. */
  modId: string;
  /** Names of the pack's mods that declare it, sorted. */
  requiredBy: string[];
};

/**
 * Declared dependencies that no library mod in the pack provides. Library
 * mods count only `required` dependencies; custom mods list library mod IDs.
 * A dependency is met by any pack library mod that declares that ID in
 * `modIds`. Version ranges are not checked.
 */
export function missingDependencies(
  libraryMods: readonly Pick<LibraryMeta, "name" | "modIds" | "dependencies">[],
  customMods: readonly { name: string; dependencies: readonly string[] }[],
): MissingDependency[] {
  const provided = new Set(libraryMods.flatMap((m) => m.modIds));
  const missing = new Map<string, Set<string>>();
  const need = (modId: string, by: string) => {
    if (IGNORED_DEPENDENCY_IDS.has(modId) || provided.has(modId)) return;
    if (!missing.has(modId)) missing.set(modId, new Set());
    missing.get(modId)!.add(by);
  };
  for (const mod of libraryMods) {
    for (const dep of mod.dependencies) {
      if (dep.type === "required") need(dep.modId, mod.name);
    }
  }
  for (const mod of customMods) {
    for (const modId of mod.dependencies) need(modId, mod.name);
  }
  return [...missing]
    .map(([modId, by]) => ({
      modId,
      requiredBy: [...by].sort(compareCodeUnits),
    }))
    .sort((a, b) => compareCodeUnits(a.modId, b.modId));
}
