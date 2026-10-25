# 0006. Mod data from static extraction plus AI inference, run by a Claude Code skill

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The Modpack Planner needs each library mod's items, recipes, tags and icons. Much of this is in the jar as data files (metadata, lang files, textures, recipe and tag JSON). Some mods register content in code, often with IDs computed from enums or lists.

## Decision

- `tools/extract-jar.ts` is a deterministic script. It reads a jar and writes `data/library/<modid>/{meta,items,recipes,tags}.json` and textures under `assets/textures/<namespace>/`. For the vanilla jar it writes `data/vanilla/1.21.1/` instead. Its output is sorted and stable, so re-runs give clean diffs.
- The `import-mods` skill (`.claude/skills/import-mods/SKILL.md`) runs the script locally. It then decompiles library jars with CFR and adds registrations and recipes that the script missed.
- Every added record has `"source": "inferred"` and an `"evidence"` field naming the class and method. Extracted records have `"source": "extracted"`.
- Inferred records are added only if the ID is fully resolvable from code; never from guesses, configs or runtime data.

## Consequences

- Imports run on the user's machine with Claude Code, not on Vercel; jars must be in the repo first (ADR 0005).
- The UI must visibly distinguish inferred data.
- The script's output format is the canonical format for library data; Prettier ignores `data/` so it never reformats it.
- The import needs Java for CFR; without it, only extracted data is produced.

## Alternatives considered

- **Runtime dump via a headless Minecraft server:** needs an always-on machine or VPS, infrastructure and sandboxing for untrusted mods.
- **Pure static parsing:** misses content registered in code.
- **Bytecode heuristics alone:** computed IDs cannot be resolved without understanding the code.
