import { unzipSync } from "fflate";

/** Jar entries the extractor needs, by path inside the jar. */
export type JarFiles = Map<string, Uint8Array>;

const RELEVANT = [
  /^META-INF\/(neoforge\.mods\.toml|mods\.toml|MANIFEST\.MF)$/,
  /^fabric\.mod\.json$/,
  /^version\.json$/,
  /^assets\/[^/]+\/lang\/en_us\.json$/,
  /^assets\/[^/]+\/models\/.+\.json$/,
  /^assets\/[^/]+\/textures\/.+\.png$/,
  /^data\/[^/]+\/recipe\/.+\.json$/,
  /^data\/[^/]+\/tags\/item\/.+\.json$/,
];

/** Folders that older Minecraft versions used; counted for a warning, not read. */
const LEGACY = /^data\/[^/]+\/(recipes|tags\/items)\/.+\.json$/;

/** Reads only the relevant entries of a jar (zip). Nested jars are ignored. */
export function readJar(bytes: Uint8Array): {
  files: JarFiles;
  legacyEntries: number;
} {
  let legacyEntries = 0;
  const entries = unzipSync(bytes, {
    filter: (file) => {
      if (file.name.endsWith("/")) return false;
      if (LEGACY.test(file.name)) legacyEntries += 1;
      return RELEVANT.some((pattern) => pattern.test(file.name));
    },
  });
  return { files: new Map(Object.entries(entries)), legacyEntries };
}

const decoder = new TextDecoder();

/** UTF-8 text without a byte-order mark. */
export function text(bytes: Uint8Array): string {
  return decoder.decode(bytes).replace(/^﻿/, "");
}

/** Parsed JSON of a jar entry, or `undefined` if missing or invalid. */
export function readJson(files: JarFiles, path: string): unknown {
  const bytes = files.get(path);
  if (!bytes) return undefined;
  try {
    return JSON.parse(text(bytes));
  } catch {
    return undefined;
  }
}
