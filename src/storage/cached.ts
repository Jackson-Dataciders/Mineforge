import type { z } from "zod";
import { decodeJson } from "@/lib/stable-json";
import type { StorageBackend } from "./types";

/**
 * Parsed JSON files cached in memory by path and blob SHA. Content-addressed,
 * so an entry is never stale: a changed file has a new SHA. A warm server
 * instance re-reads only files that changed (library data, entries).
 */
const CACHE_LIMIT = 256;
const parsedCache = new Map<string, unknown>();

function remember(key: string, value: unknown) {
  parsedCache.delete(key);
  parsedCache.set(key, value);
  while (parsedCache.size > CACHE_LIMIT) {
    parsedCache.delete(parsedCache.keys().next().value!);
  }
}

/**
 * Reads and validates `path`, known to have blob `sha` (from a listing).
 * Returns `null` if the file is gone. Invalid data throws.
 */
export async function readCached<S extends z.ZodType>(
  storage: StorageBackend,
  path: string,
  sha: string,
  schema: S,
): Promise<z.output<S> | null> {
  const key = `${path}@${sha}`;
  if (parsedCache.has(key)) {
    const value = parsedCache.get(key) as z.output<S>;
    remember(key, value);
    return value;
  }
  const file = await storage.readFile(path);
  if (!file) return null;
  const parsed = schema.safeParse(decodeJson(file.content));
  if (!parsed.success) {
    throw new Error(`Invalid data in ${path}: ${parsed.error.message}`);
  }
  remember(`${path}@${file.sha}`, parsed.data);
  return parsed.data;
}
