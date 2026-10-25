import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { extractJar } from "./extract";
import { ExtractError } from "./metadata";
import { writeExtraction } from "./write";

const USAGE =
  "Usage: npx tsx tools/extract-jar.ts <path-to-jar> [--out <repo-root>]";

type Output = { log: (line: string) => void; error: (line: string) => void };

/**
 * CLI behind `npx tsx tools/extract-jar.ts` (called by the import-mods skill).
 * Returns the exit code: 0 on success, 1 on any error.
 */
export function runCli(
  args: string[],
  defaultRoot: string,
  out: Output = console,
): number {
  const outIndex = args.indexOf("--out");
  const repoRoot = path.resolve(
    outIndex >= 0 ? (args[outIndex + 1] ?? "") : defaultRoot,
  );
  const jarArg = args.find(
    (a, i) => !a.startsWith("--") && (outIndex < 0 || i !== outIndex + 1),
  );
  if (!jarArg || (outIndex >= 0 && !args[outIndex + 1])) {
    out.error(USAGE);
    return 1;
  }

  const jarPath = path.resolve(jarArg);
  const jarFile = path.relative(repoRoot, jarPath).split(path.sep).join("/");
  if (!existsSync(jarPath)) {
    out.error(`Jar not found: ${jarArg}`);
    return 1;
  }
  if (!jarFile.startsWith("jars/")) {
    out.error(
      `The jar must be inside ${path.join(repoRoot, "jars")} (got ${jarArg})`,
    );
    return 1;
  }

  try {
    const extraction = extractJar(new Uint8Array(readFileSync(jarPath)), {
      jarFile,
      textureExists: (iconPath) =>
        existsSync(path.join(repoRoot, "assets/textures", iconPath)),
    });
    const summary = writeExtraction(extraction, repoRoot);
    const id = extraction.meta
      ? `${extraction.meta.modId} ${extraction.meta.version} (${extraction.meta.loader})`
      : "minecraft 1.21.1 (vanilla)";
    out.log(
      `${id} — ${summary.items} items (${summary.inferredItems} inferred), ${summary.recipes} recipes, ` +
        `${summary.tags} tags, ${summary.iconsMissing} icons missing, ${summary.iconFallbacks} icon fallbacks ` +
        `→ ${summary.dataDir} (${summary.filesChanged} files changed)`,
    );
    for (const warning of extraction.warnings) out.log(`warning: ${warning}`);
    return 0;
  } catch (error) {
    if (error instanceof ExtractError) {
      out.error(`error: ${error.message}`);
      return 1;
    }
    out.error(`error: ${(error as Error).stack ?? String(error)}`);
    return 1;
  }
}
