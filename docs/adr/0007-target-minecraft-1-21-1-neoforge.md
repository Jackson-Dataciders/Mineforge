# 0007. Target Minecraft 1.21.1 on NeoForge

- **Status:** accepted (handling of other loaders and versions refined by [0016](0016-import-non-neoforge-jars-with-warning.md): imported with a warning, not just flagged)
- **Date:** 2026-10-25

## Context

Recipe formats, data folder names and tag conventions change between Minecraft versions and loaders. Supporting several at once would multiply parsing and export code.

## Decision

- The only supported target is **Minecraft 1.21.1 with NeoForge**.
- Data paths follow 1.21.1 conventions:
  - recipes in `data/<ns>/recipe/` (singular)
  - item tags in `data/<ns>/tags/item/` (singular)
  - common tags under the `c:` namespace (e.g. `c:ingots/iron`)
- Mod metadata comes from `META-INF/neoforge.mods.toml`.
- IDs are always namespaced (`minecraft:stone`).

## Consequences

- The extraction script, Zod schemas, recipe editors and KubeJS export can hard-code these conventions.
- Mods for other loaders or versions are out of scope. The import flags them instead of importing them.
- Moving to another version later needs a new ADR and a migration of `data/`.

## Alternatives considered

None were listed when the decision was made.
