import { z } from "zod";

/** GitHub rejects files above 100 MiB (ADR 0005). */
export const MAX_JAR_BYTES = 100 * 1024 * 1024;

/** File names under `jars/mods/`: no paths, a safe character set, `.jar`. */
export const JAR_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,195}\.jar$/;
export const jarNameSchema = z.string().regex(JAR_NAME_PATTERN);

/** The name a selected file is uploaded under: unsafe characters → `_`. */
export function sanitizeJarName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const stem = base.replace(/\.jar$/i, "");
  const safe = stem
    .replace(/[^A-Za-z0-9._+-]+/g, "_")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 190);
  return `${safe || "mod"}.jar`;
}

export type JarFileProblem = "notJar" | "tooLarge" | "empty";

/** Checks done before uploading, so nothing large is sent in vain. */
export function jarFileProblem(file: {
  name: string;
  size: number;
}): JarFileProblem | null {
  if (!/\.jar$/i.test(file.name)) return "notJar";
  if (file.size === 0) return "empty";
  if (file.size > MAX_JAR_BYTES) return "tooLarge";
  return null;
}
