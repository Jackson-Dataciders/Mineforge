import { jarNameSchema } from "@/domain/jar-upload";
import { paths } from "./paths";
import { ValidationError, type StorageBackend } from "./types";

export type UploadedJar = { name: string; sha: string };

const BLOB_SHA = /^[0-9a-f]{40}$/;

/**
 * Commits jars whose blobs the browser already created on GitHub
 * (ADR 0005) to `jars/mods/<name>`, all in one commit. Existing jars are
 * never overwritten: an existing name fails before the commit, and a jar
 * added concurrently fails the commit's expected-SHA check.
 */
export async function commitUploadedJars(
  storage: StorageBackend,
  jars: readonly UploadedJar[],
): Promise<{ paths: string[] }> {
  if (jars.length === 0) throw new ValidationError("invalidInput");
  const names = new Set<string>();
  for (const jar of jars) {
    if (!jarNameSchema.safeParse(jar.name).success || !BLOB_SHA.test(jar.sha)) {
      throw new ValidationError("invalidInput");
    }
    if (names.has(jar.name)) throw new ValidationError("invalidInput");
    names.add(jar.name);
  }
  const existing = new Set(
    (await storage.listDir(paths.modJarsDir)).map((e) => e.name),
  );
  if (jars.some((jar) => existing.has(jar.name))) {
    throw new ValidationError("jarExists");
  }
  const jarPaths = jars.map((jar) => `${paths.modJarsDir}/${jar.name}`);
  await storage.commit({
    message:
      `data: upload ${jars.length === 1 ? "jar" : "jars"} ${jars.map((j) => j.name).join(", ")}`.slice(
        0,
        500,
      ),
    changes: jars.map((jar, i) => ({ path: jarPaths[i]!, blobSha: jar.sha })),
    expected: Object.fromEntries(jarPaths.map((p) => [p, null])),
  });
  return { paths: jarPaths };
}
