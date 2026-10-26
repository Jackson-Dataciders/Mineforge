import { z } from "zod";
import { MOD_ID_PATTERN } from "./ids";

/**
 * Entry IDs are `<modid>:<path>` and never change (ADR 0021). The path is
 * also the file name (`entries/<path>.json`) and icon name.
 */
export const ENTRY_PATH_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export const isEntryPath = (value: string) => ENTRY_PATH_PATTERN.test(value);

export function isEntryId(value: string): boolean {
  const [modId, path, ...rest] = value.split(":");
  return (
    rest.length === 0 &&
    MOD_ID_PATTERN.test(modId ?? "") &&
    ENTRY_PATH_PATTERN.test(path ?? "")
  );
}

export const entryIdSchema = z.string().refine(isEntryId, "Invalid entry ID");

/** Splits an entry ID; assumes `isEntryId`. */
export function splitEntryId(id: string): { modId: string; path: string } {
  const [modId, path] = id.split(":") as [string, string];
  return { modId, path };
}

/** Suggests an entry path from an English name, e.g. "Iron Gear" → "iron_gear". */
export function suggestEntryPath(name: string): string {
  let path = name
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join("_");
  if (path && !/^[a-z]/.test(path)) path = `entry_${path}`;
  path = path.slice(0, 64).replace(/_+$/, "");
  return isEntryPath(path) ? path : "";
}
