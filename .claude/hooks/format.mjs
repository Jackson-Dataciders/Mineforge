// PostToolUse hook (Edit|Write): formats the edited file with Prettier.
// Reads the hook JSON from stdin and uses tool_input.file_path. Skips files
// outside the project, files in .prettierignore and files Prettier can't parse.
// Never blocks: failures are reported on stderr and exit 0, since lint,
// typecheck and tests catch real errors.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectDir = path.resolve(
  process.env.CLAUDE_PROJECT_DIR ?? path.join(import.meta.dirname, "..", ".."),
);

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const filePath = input?.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath === "") process.exit(0);

  const absolute = path.resolve(input.cwd ?? projectDir, filePath);
  const relative = path.relative(projectDir, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) process.exit(0);

  const prettier = await import("prettier");
  const info = await prettier.getFileInfo(absolute, {
    ignorePath: path.join(projectDir, ".prettierignore"),
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) process.exit(0);

  const config = (await prettier.resolveConfig(absolute)) ?? {};
  const source = readFileSync(absolute, "utf8");
  const formatted = await prettier.format(source, {
    ...config,
    filepath: absolute,
  });
  if (formatted !== source) writeFileSync(absolute, formatted);
} catch (error) {
  process.stderr.write(`format hook: ${error?.message ?? error}\n`);
}
process.exit(0);
