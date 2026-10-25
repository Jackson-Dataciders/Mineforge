import { strToU8, zipSync } from "fflate";

/** Builds an in-memory jar for tests. Objects are written as JSON, strings as UTF-8. */
export function buildJar(
  entries: Record<string, string | object | Uint8Array>,
): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [path, value] of Object.entries(entries)) {
    files[path] =
      value instanceof Uint8Array
        ? value
        : strToU8(
            typeof value === "string" ? value : JSON.stringify(value, null, 2),
          );
  }
  return zipSync(files);
}

/** A few distinct bytes standing in for a PNG; the extractor copies textures as-is. */
export const fakePng = (label: string) => strToU8(`\x89PNG-${label}`);
