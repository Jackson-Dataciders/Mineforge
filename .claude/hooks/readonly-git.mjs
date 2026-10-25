// PreToolUse hook for the reviewer subagent (matcher: Bash|PowerShell).
// Allows only single, read-only git commands; everything else is blocked
// with exit code 2, which Claude Code shows to the subagent as the reason.
import { readFileSync } from "node:fs";

const READ_ONLY =
  /^git (diff|log|show|status|blame|ls-files|rev-parse|merge-base|grep|branch --show-current)(\s|$)/;
// Shell operators, redirects, substitutions and options that write or run code.
const FORBIDDEN = /[;&|<>`$\n\r]|--output|--ext-diff|(^|\s)-c\s|--exec/;

function block(reason) {
  process.stderr.write(`Blocked for the read-only reviewer: ${reason}\n`);
  process.exit(2);
}

let command;
try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  command = String(input?.tool_input?.command ?? "").trim();
} catch {
  block("could not read the hook input.");
}

if (FORBIDDEN.test(command)) {
  block("compound commands, redirects and writing options are not allowed.");
}
if (!READ_ONLY.test(command)) {
  block(
    "only read-only git commands (diff, log, show, status, blame, ls-files, rev-parse, merge-base, grep) are allowed. Use Read, Grep and Glob for files.",
  );
}
process.exit(0);
