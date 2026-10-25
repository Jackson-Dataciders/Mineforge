# 0017. Library data format

- **Status:** accepted (`meta.json` `logo` field refined by [0019](0019-mod-logo-in-library-meta.md))
- **Date:** 2026-10-25

## Context

The extraction script writes library and vanilla data. From phase 3 on, the item search, recipe editors, dependency warnings and KubeJS export read it. The format has to be stable, diff-friendly in git, able to tell inferred data apart, and not lose information the editors may need later.

## Decision

- **Schemas** in `src/domain/library.ts` are the source of truth for `data/library/<modid>/*` and `data/vanilla/1.21.1/*`.
- **`meta.json`** (mods only): `modId`, `name`, `version`, `loader`, `minecraftVersionRange` (as declared, or `null`), `modIds`, `jarFile` (repo-relative), `jarSha256`, `dependencies[]` (`modId`, `type` = required/optional/incompatible/discouraged, `versionRange` as declared).
- **`items.json`:** `[{ id, name, icon, iconFallback?, source, evidence? }]`.
  - `icon` is a path under `assets/textures/` (served at `/api/textures/<icon>`), or `null`. The skill's "leave the icon empty" means `null`.
  - `iconFallback: true` marks a block face used as the icon.
  - Names are en_us.
- **`recipes.json`:** `[{ id, type, source, evidence?, data }]`, where `data` is the **raw recipe JSON** from the jar, conditions included. Typed parsing per recipe type happens in `src/domain` when the editors need it (phase 3).
- **`tags.json`:** `{ "<tag id>": { replace, values } }`, item tags only. Values are strings (`id` or `#tag`) or `{ id, required }`.
- **Inferred records** (`source: "inferred"`) must have non-empty `evidence` (enforced by the schema). Re-running the script keeps them unless the same ID is now extracted.
- **Format:**
  - all sorting is by UTF-16 code units (`compareCodeUnits` in `src/lib/stable-json.ts`), never locale-dependent;
  - deterministic: arrays sorted by `id`, `stableStringify` (sorted keys, 2 spaces, trailing newline);
  - no timestamps, so re-runs produce identical bytes;
  - Prettier ignores `data/`.

## Consequences

- No information is lost: modded recipe types (e.g. `farmersdelight:cooking`, `create:mixing`) are kept as-is for the JSON editor and `event.custom()` export.
- Consumers need typed accessors for `data` per recipe type; unknown types stay JSON.
- An import copies only textures in its own namespaces (`minecraft` for vanilla, the declared mod IDs for mods). An item that points at another namespace's texture links to it only if that file is already in the repo, so no import overwrites another mod's or vanilla's textures.
- Changing these shapes requires migrating existing `data/` files and updating the skill text.

## Alternatives considered

- **Normalizing recipes into one internal model at extraction time:** this would drop unknown types and lose fields before the editors' needs are known.
- **Timestamps (`importedAt`) in meta:** they would break byte-identical re-runs and add noise to diffs; git history already records when an import happened.
