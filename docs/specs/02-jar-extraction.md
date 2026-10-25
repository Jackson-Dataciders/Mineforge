# 02. Jar extraction and import skill

- **Status:** implemented
- **Date:** 2026-10-25
- **Related ADRs:** [0006](../adr/0006-static-extraction-plus-ai-inference.md), [0007](../adr/0007-target-minecraft-1-21-1-neoforge.md), [0016](../adr/0016-import-non-neoforge-jars-with-warning.md), [0017](../adr/0017-library-data-format.md), [0019](../adr/0019-mod-logo-in-library-meta.md)

## Goal

Mod jars and the vanilla 1.21.1 client jar become library data (items with English names and icons, recipes, item tags, metadata) that the Modpack Planner and the Mod Designer can search. A deterministic script does this, and the `import-mods` skill calls it.

## Scope

- `tools/extract-jar.ts`, a deterministic, idempotent CLI run with `npx tsx`.
- Library data schemas in `src/domain/library.ts`.
- `import-mods` skill alignment (dependency ignore list, ADR 0016).

## Out of scope

- The inference step (CFR decompiling) and commits; the skill does those.
- Any UI. The library page, uploads and warnings come in phase 3.
- Nested jars (`META-INF/jarjar/`, `META-INF/jars/`).

## Requirements

1. **CLI:** `npx tsx tools/extract-jar.ts <path-to-jar> [--out <repo-root>]`. The default root is the repo containing the script.
   - The jar must lie inside `<root>/jars/`; `jarFile` is stored repo-relative.
   - Prints `<modid> <version> (<loader>) — <n> items (<k> inferred), <r> recipes, <t> tags, <i> icons missing, <f> icon fallbacks → <data dir> (<c> files changed)`, plus `warning:` lines.
   - Exit code 1 on any error.
2. **Jar kind** (ADR 0016):
   - `META-INF/neoforge.mods.toml` → `neoforge`, else `META-INF/mods.toml` → `forge`, else `fabric.mod.json` → `fabric`;
   - else root `version.json` → vanilla, which must have `id` `1.21.1`;
   - otherwise an error.
3. **Metadata (NeoForge/Forge):**
   - all `[[mods]]` entries; the first one is `modId` (and the folder name); `displayName` defaults to the mod ID;
   - `${file.jarVersion}` → MANIFEST `Implementation-Version`, else `unknown`.
   - Dependencies come from every `[[dependencies.*]]` table, excluding mods inside the jar and deduplicated by mod ID: `type`, else legacy `mandatory`, else `required`; `versionRange` defaults to `*`.
4. **Metadata (Fabric):**
   - `depends` → required, `recommends`/`suggests` → optional, `breaks` → incompatible, `conflicts` → discouraged;
   - array ranges are joined with `||`.
5. `minecraftVersionRange` is the declared `minecraft` dependency range, or `null`.
6. **Item namespaces:** `minecraft` for vanilla; the declared mod IDs for mods. Content that a mod jar ships in other namespaces (resource-pack overrides) is ignored for items and textures.
7. **Items:**
   - lang keys `item.<ns>.<path>` / `block.<ns>.<path>` with exactly three segments, in `assets/<ns>/lang/en_us.json`;
   - **only** if `assets/<ns>/models/item/<path>.json` exists; `item.*` names win over `block.*`.
   - Keys without an item model are skipped: blocks without an item form, and stale lang entries such as vanilla's `pottery_shard_*`.
8. **Icons:**
   - follow `parent` inside the jar (depth ≤ 16, no cycles), merging textures child-over-parent and resolving `#var` (≤ 8 hops);
   - `layer0` → icon;
   - if the chain contains a `block/` model: the first of `all, side, front, top, end, texture, particle` → icon with `iconFallback: true`;
   - `builtin/entity` → no icon.
   - Only textures in the jar's own namespaces are copied, to `assets/textures/<ns>/<path>.png`.
   - Any other texture (another namespace, or missing from the jar) keeps its path only if that file already exists in the repo; otherwise `icon: null`.
   - Texture paths that are not valid icon paths (`..` segments, uppercase letters) give `icon: null` plus a warning; the item is kept.
9. **Recipes:** every `data/<ns>/recipe/**/*.json` in any namespace, with ID `<ns>:<path>` and the raw JSON as `data`. Files without an object with a string `type` are skipped with a warning.
10. **Tags:** every `data/<ns>/tags/item/**/*.json` → `{ replace, values }`.
    - Object values are normalized to `{ id, required }` (`required` defaults to `true`).
    - Values without a string ID, or of the wrong type, are dropped with a warning.
11. **Legacy folders:** files in `recipes/` or `tags/items/` (before 1.21) are counted in a warning, not read.
12. **Output:**
    - vanilla → `data/vanilla/1.21.1/{items,recipes,tags}.json`;
    - mods → `data/library/<modid>/{meta,items,recipes,tags}.json`;
    - arrays sorted by `id` in code-unit order (locale-independent), `stableStringify` (sorted keys, 2 spaces, trailing newline), no timestamps.
13. **Idempotency:**
    - Files are written only when their content changes.
    - Existing `source: "inferred"` items or recipes with IDs that weren't extracted are kept; extracted records replace inferred ones with the same ID.
    - An existing `meta.json`, `items.json`, `recipes.json` or `tags.json` that isn't valid JSON or fails the schema aborts the run before anything is written.
14. **Path safety:**
    - Mod IDs must match `^[a-z][a-z0-9_-]{1,63}$` (they become folder names); metadata is validated before writing.
    - Every write is checked to stay inside its data folder or `assets/textures/`.
15. **Skill:** `import-mods` keeps its command; step 4 also ignores `forge` and `fabricloader`.
16. **Mod logo** (added in phase 3, spec 03, ADR 0019): NeoForge/Forge `logoFile` (first `[[mods]]` entry, else top level) or Fabric `icon` (largest size ≤ 256, else the smallest). Only a `.png` present in the jar is copied, to `assets/textures/<modid>/_logo.png`; `meta.json` `logo` holds that path or `null`, with a warning for a missing or non-PNG logo.

## Acceptance criteria

- [x] Fixture tests cover:
  - NeoForge: two mods, manifest version, dependencies, icon kinds, stale lang keys, recipe namespaces, tags, legacy folder warning;
  - Forge `mandatory`, Fabric, multi-loader preference;
  - vanilla and its version check, missing metadata;
  - hostile input: bad mod ID, `..` texture paths, other-namespace overrides, invalid tag values.
- [x] CLI tests:
  - output files and summary;
  - idempotent re-run (0 files changed);
  - inferred items and recipes preserved;
  - invalid existing file aborts the run;
  - errors for jars outside `jars/` and for missing jars.
- [x] Real vanilla `client.jar` 1.21.1: 1333 items, 1290 recipes, 147 tags. 63 items have no icon (`builtin/entity` items and `air`). A second run changes 0 files.
- [x] Real NeoForge mod (Farmer's Delight 1.3.4): 184 items, 333 recipes, 105 tags, 0 icons missing.
- [x] `npm run check` and `npm run build` pass.

## Open questions

- None open.
