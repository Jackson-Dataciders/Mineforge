# 0021. Entry and custom recipe type formats

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Phase 4 stores custom mod entries and custom machine recipe types. Entries reference each other (relations, ingredients, multiblock cells, involved entries), recipe types reference a machine entry, and entries reference recipe types. ADR 0009 fixes the schema technique (Zod discriminated unions). It doesn't fix:

- IDs;
- which entries count as items;
- what happens to references on delete;
- where recipe types live;
- how icons are stored.

The user decided:

- entry IDs are immutable;
- only item and block entries are items;
- deleting an entry removes manual relations to it and leaves other references visible as missing;
- dependencies are edited in phase 4.

## Decision

- **Entry ID:** `<modid>:<path>`, path `^[a-z][a-z0-9_]{0,63}$`, file `data/custom-mods/<modid>/entries/<path>.json`. Suggested from the name, editable on create, unique, never changed (as ADR 0015).
- **Item entries:** only `item` and `block` entries appear in item searches and have `recipes`. Other types are linked through relations.
- **Relations:** stored on the source entry as `{ type, target, label? }`. The types are `drops_from`, `part_of_multiblock`, `generated_in_structure`, `powers` and `custom` (with a label). They are typed now so the phase 6 mind map needs no migration. Targets are entries of the same mod.
- **Fields that depend on a choice** (`kind`, harvest tool, GUI, drops) are nested discriminated unions, never optional fields with refinements.
- **Icon:** `assets/icons/<modid>/<path>.png`, a validated 16×16 PNG (≤ 16 KB). It is written in the same commit as the entry; the entry's `icon: true` records it.
- **Deleting an entry:** one commit removes the entry file and its icon, and rewrites every other entry of the mod whose relations target it (expected SHAs for all). Ingredients, layout cells, controllers, involved entries and recipe-type machines keep the ID and are shown as missing.
- **Custom machine recipe types:** stored in `mod.json` as `recipeTypes[]`, each `{ id, name, machine, inputs, outputs, parameters }`.
  - Recipes of a custom type are `{ type: "custom", recipeType, inputs, outputs, processingTime?, energyCost? }` inside the entry's `recipes`.
  - They are validated against their type in `src/domain` and again by storage on save. A type can't be deleted while used without a confirmation.
- **Dependencies:** `mod.json` `dependencies` holds library mod folder IDs (Fabric IDs may contain `-`).

## Consequences

- References by ID stay stable; there is no rename migration.
- Entry writes need the mod's other entries and `mod.json` for validation; storage reads them through the same SHA-keyed cache as library data.
- A deleted entry can leave visible dangling IDs, which the UI marks instead of hiding.
- Adding relation types later is a schema change with a default-free enum extension.

## Alternatives considered

- **Renameable entry IDs:** every rename rewrites many files. The user rejected it.
- **Blocking deletes while referenced:** safer, but makes clean-up tedious. The user rejected it.
- **All entry types as items:** entities, structures and mechanics have no item form in the game. The user rejected it.
- **Recipe types as separate files:** one more folder, for a handful of small definitions that belong to the mod.
