import type { z } from "zod";
import { decodeJson, encodeJson } from "./stable-json";
import type { StorageBackend } from "./types";

/** A parsed document plus the blob SHA it was read at, for conflict-safe writes. */
export type Versioned<T> = { data: T; sha: string };

/** Reads and validates a JSON document; `null` if the file doesn't exist. Invalid data throws. */
export async function readDocument<S extends z.ZodType>(
  storage: StorageBackend,
  path: string,
  schema: S,
): Promise<Versioned<z.output<S>> | null> {
  const file = await storage.readFile(path);
  if (!file) return null;
  const parsed = schema.safeParse(decodeJson(file.content));
  if (!parsed.success) {
    throw new Error(`Invalid data in ${path}: ${parsed.error.message}`);
  }
  return { data: parsed.data, sha: file.sha };
}

/** Validates and serializes a document for writing. */
export function encodeDocument<S extends z.ZodType>(
  schema: S,
  value: z.input<S>,
): Uint8Array {
  return encodeJson(schema.parse(value));
}
