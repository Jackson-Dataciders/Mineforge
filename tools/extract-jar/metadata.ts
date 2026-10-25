import { parse as parseToml } from "smol-toml";
import {
  TARGET_MINECRAFT_VERSION,
  type LibraryDependency,
  type LibraryMeta,
  type Loader,
} from "../../src/domain/library";
import { compareCodeUnits } from "../../src/lib/stable-json";
import { readJson, text, type JarFiles } from "./zip";

/** Metadata read from the jar; the file-level fields are added by the caller. */
export type ModMetadata = Omit<LibraryMeta, "jarFile" | "jarSha256">;
export type JarKind = { kind: "vanilla" } | { kind: "mod"; meta: ModMetadata };

export class ExtractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractError";
  }
}

const DEPENDENCY_TYPES = new Set([
  "required",
  "optional",
  "incompatible",
  "discouraged",
]);
type Table = Record<string, unknown>;
const isTable = (v: unknown): v is Table =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

function manifestValue(files: JarFiles, key: string): string | undefined {
  const bytes = files.get("META-INF/MANIFEST.MF");
  if (!bytes) return undefined;
  const line = text(bytes)
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim() || undefined;
}

function sortDependencies(deps: LibraryDependency[]): LibraryDependency[] {
  const seen = new Set<string>();
  return deps
    .filter((d) => (seen.has(d.modId) ? false : (seen.add(d.modId), true)))
    .sort((a, b) => compareCodeUnits(a.modId, b.modId));
}

/** NeoForge `neoforge.mods.toml` or Forge `mods.toml` (ADR 0016). */
function readModsToml(
  files: JarFiles,
  path: string,
  loader: Loader,
): ModMetadata {
  let doc: Table;
  try {
    doc = parseToml(text(files.get(path)!)) as Table;
  } catch (error) {
    throw new ExtractError(`Invalid ${path}: ${(error as Error).message}`);
  }
  const mods = (Array.isArray(doc.mods) ? doc.mods : []).filter(isTable);
  const modIds = mods
    .map((m) => str(m.modId))
    .filter((id): id is string => !!id);
  const first = mods[0];
  if (!first || modIds.length === 0)
    throw new ExtractError(`${path} declares no [[mods]]`);

  let version = str(first.version) ?? "1";
  if (version.includes("${")) {
    version = manifestValue(files, "Implementation-Version") ?? "unknown";
  }

  const dependencies: LibraryDependency[] = [];
  const depTables = isTable(doc.dependencies) ? doc.dependencies : {};
  for (const list of Object.values(depTables)) {
    for (const dep of (Array.isArray(list) ? list : []).filter(isTable)) {
      const modId = str(dep.modId);
      if (!modId || modIds.includes(modId)) continue;
      const declaredType = str(dep.type)?.toLowerCase();
      const type =
        declaredType && DEPENDENCY_TYPES.has(declaredType)
          ? (declaredType as LibraryDependency["type"])
          : typeof dep.mandatory === "boolean"
            ? dep.mandatory
              ? "required"
              : "optional"
            : "required";
      dependencies.push({
        modId,
        type,
        versionRange: str(dep.versionRange) ?? "*",
      });
    }
  }

  return {
    modId: modIds[0]!,
    name: str(first.displayName) ?? modIds[0]!,
    version,
    loader,
    minecraftVersionRange:
      dependencies.find((d) => d.modId === "minecraft")?.versionRange ?? null,
    modIds,
    dependencies: sortDependencies(dependencies),
  };
}

const FABRIC_DEPENDENCY_FIELDS: [string, LibraryDependency["type"]][] = [
  ["depends", "required"],
  ["recommends", "optional"],
  ["suggests", "optional"],
  ["breaks", "incompatible"],
  ["conflicts", "discouraged"],
];

const fabricRange = (v: unknown): string =>
  Array.isArray(v) ? v.map(String).join(" || ") : (str(v) ?? "*");

/** Fabric `fabric.mod.json` (ADR 0016). */
function readFabricJson(files: JarFiles): ModMetadata {
  const doc = readJson(files, "fabric.mod.json");
  if (!isTable(doc) || !str(doc.id))
    throw new ExtractError("Invalid fabric.mod.json");
  const modId = str(doc.id)!;
  const dependencies: LibraryDependency[] = [];
  for (const [field, type] of FABRIC_DEPENDENCY_FIELDS) {
    const map = isTable(doc[field]) ? (doc[field] as Table) : {};
    for (const [depId, range] of Object.entries(map)) {
      if (depId !== modId)
        dependencies.push({
          modId: depId,
          type,
          versionRange: fabricRange(range),
        });
    }
  }
  return {
    modId,
    name: str(doc.name) ?? modId,
    version: str(doc.version) ?? "unknown",
    loader: "fabric",
    minecraftVersionRange:
      dependencies.find((d) => d.modId === "minecraft")?.versionRange ?? null,
    modIds: [modId],
    dependencies: sortDependencies(dependencies),
  };
}

/**
 * Identifies the jar: NeoForge, Forge or Fabric metadata, in that order
 * (ADR 0016), otherwise the vanilla client jar (`version.json`, 1.21.1 only).
 */
export function readMetadata(files: JarFiles): JarKind {
  if (files.has("META-INF/neoforge.mods.toml")) {
    return {
      kind: "mod",
      meta: readModsToml(files, "META-INF/neoforge.mods.toml", "neoforge"),
    };
  }
  if (files.has("META-INF/mods.toml")) {
    return {
      kind: "mod",
      meta: readModsToml(files, "META-INF/mods.toml", "forge"),
    };
  }
  if (files.has("fabric.mod.json"))
    return { kind: "mod", meta: readFabricJson(files) };

  const version = readJson(files, "version.json");
  if (isTable(version)) {
    if (version.id !== TARGET_MINECRAFT_VERSION) {
      throw new ExtractError(
        `Vanilla jar is version ${String(version.id)}; only ${TARGET_MINECRAFT_VERSION} is supported`,
      );
    }
    return { kind: "vanilla" };
  }
  throw new ExtractError(
    "No mod metadata (neoforge.mods.toml, mods.toml, fabric.mod.json) and not a vanilla client jar",
  );
}
