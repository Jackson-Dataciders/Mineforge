/**
 * Deterministic jar extraction (ADR 0006, spec docs/specs/02-jar-extraction.md).
 *
 *   npx tsx tools/extract-jar.ts <path-to-jar> [--out <repo-root>]
 *
 * Writes data/library/<modid>/{meta,items,recipes,tags}.json (or
 * data/vanilla/1.21.1/* for the vanilla client jar) and copies item icons to
 * assets/textures/<namespace>/. Re-runs give identical output.
 */
import path from "node:path";
import { runCli } from "./extract-jar/cli";

const repoRoot = path.resolve(path.dirname(process.argv[1] ?? "."), "..");
process.exitCode = runCli(process.argv.slice(2), repoRoot);
