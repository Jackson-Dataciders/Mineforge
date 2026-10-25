# 0016. Import non-NeoForge jars with the loader recorded and a warning

- **Status:** accepted
- **Date:** 2026-10-25
- **Refines:** [0007](0007-target-minecraft-1-21-1-neoforge.md) (its consequence "the import flags them instead of importing them")

## Context

ADR 0007 makes Minecraft 1.21.1 on NeoForge the only target and says the import only flags mods for other loaders or versions. The phase 2 brief, however, has `tools/extract-jar.ts` read metadata from `META-INF/neoforge.mods.toml`, `META-INF/mods.toml` or `fabric.mod.json`, record the loader, and write the data files. Such mods normally won't load in a NeoForge 1.21.1 pack (unless a compatibility layer is used), so planning recipes around them can be misleading. The user decided to import them anyway, visibly marked.

## Decision

- **Loader detection**, in this order:
  1. `META-INF/neoforge.mods.toml` → `neoforge`
  2. `META-INF/mods.toml` → `forge`
  3. `fabric.mod.json` → `fabric`

  A jar with metadata for several loaders counts as NeoForge if it has `neoforge.mods.toml`. A jar with none of these files is reported as an error and skipped.

- **Imported like any other library mod.** Non-NeoForge jars get the same `meta.json`, items, recipes, tags and icons. `meta.json` records `loader` and the declared Minecraft version range as written in the metadata.
- **Compatibility is computed, not stored.** A pure function in `src/domain/` decides whether a library mod matches the target: `loader === "neoforge"`, and the declared Minecraft range includes 1.21.1, or there is no declared range. A mod that matches NeoForge but declares a range without 1.21.1 is treated as incompatible as well.
- **Warnings** for incompatible mods, in the UI language, naming the loader and/or version:
  - **Library page:** a badge on the mod, e.g. "Not for NeoForge 1.21.1 (Fabric)".
  - **Modpack:** a warning listing every incompatible mod the pack contains.

  Incompatible mods can still be added to packs and searched.

- **Data paths stay 1.21.1-only** (ADR 0007): the script reads `data/<ns>/recipe/` and `data/<ns>/tags/item/` only. Jars for older versions, which use plural folder names, may yield no recipes or tags; the import report says so.
- **Dependency check:** the loader and platform IDs `minecraft`, `neoforge`, `forge`, `fabricloader` and `java` are ignored when listing missing dependencies. This extends the `import-mods` skill's ignore list in phase 2.

## Consequences

- The library can hold any mod the user drops in, and the problem is visible where it matters: when picking mods and when looking at a pack.
- `meta.json` needs `loader` (`neoforge | forge | fabric`) and a Minecraft version range field; their exact schema is defined in the phase 2 spec.
- Item search and KubeJS export treat incompatible mods' items like any other. Only the library and pack warnings point out the problem.
- The rest of ADR 0007 still applies: target, data paths, `c:` tags and namespaced IDs.

## Alternatives considered

- **Flag and skip** (ADR 0007 as written): store only identifying metadata marked unsupported, with no items or recipes. Rejected by the user in favor of importing with a warning.
