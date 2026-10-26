# 04. Mod Designer entries

- **Status:** implemented
- **Date:** 2026-10-26
- **Related ADRs:** [0009](../adr/0009-entry-types-zod-discriminated-unions.md), [0015](../adr/0015-immutable-project-ids.md), [0020](../adr/0020-recipe-change-and-pack-task-formats.md), [0021](../adr/0021-entry-and-custom-recipe-type-formats.md)

## Goal

The user can plan a custom mod's content as typed entries (item, block, entity, structure, mechanic, multiblock) with type-specific fields, recipes, relations and a 16×16 pixel-art icon. The user can also define custom machine recipe types and declare the mod's library dependencies.

## Scope

- The custom mod page: entry list, create buttons, dependencies and custom recipe types.
- The entry form, with fields per type and kind, recipes, relations and the icon.
- The 16×16 pixel editor.
- The designer search set, and the pack search set extended with entries.

## Out of scope

- Status icons in lists and the search modal, generated tasks, the taskboard (phase 5).
- The mind map and its edges (phase 6).
- KubeJS export of custom-mod recipes, block texture editing.

## Requirements

### Custom mod page (`/designer/[modId]`)

1. **Entry list:** entries grouped by type, each with icon, name, ID and a status pill, linking to its form. Six buttons create an entry of each type.
2. **Dependencies:** a dialog with checkboxes of library mods. It writes `mod.json` `dependencies` (library mod IDs) with its SHA.
3. **Recipe types:** a section where custom machine recipe types are created, edited and deleted (requirement 12).

### Entries (`data/custom-mods/<modid>/entries/<path>.json`)

4. **ID:**
   - format `<modid>:<path>`, where the path matches `^[a-z][a-z0-9_]{0,63}$`;
   - suggested from the name, editable only on create, unique in the mod;
   - immutable afterwards. The file name is `<path>.json`.
5. **Common fields:**
   - `name` (English);
   - `description`, `usage`, `notes`;
   - `status` (`backlog` | `planned` | `implemented`, default `backlog`);
   - `tags` (category tags: free text, trimmed, unique);
   - `icon` (whether `assets/icons/<modid>/<path>.png` exists);
   - `relations`: `[{ type, target, label? }]`, with
     - `type` one of `drops_from`, `part_of_multiblock`, `generated_in_structure`, `powers`, `custom`;
     - `target` an entry ID of the same mod;
     - `label` required for `custom`.
6. **Type-specific fields:** the entry is a Zod discriminated union on `type`. Item and entity have a nested union on `kind`, and dependent choices are small unions, so invalid combinations can't be saved:
   - **item:**
     - for every kind: `stackSize` (1–99), `rarity` (common, uncommon, rare, epic), `fireResistant`, `tooltip`, `obtainedVia` (any of crafting, drop, loot, trade, other);
     - `kind`:
       - `material`, `misc`: no extra fields;
       - `tool`: `tier` (wood, stone, iron, gold, diamond, netherite), `durability`, `attackDamage`, `attackSpeed`;
       - `weapon`: `durability`, `attackDamage`, `attackSpeed`;
       - `armor`: `slot` (head, chest, legs, feet), `durability`, `defense`, `toughness`;
       - `food`: `nutrition`, `saturation`, `effects` (`{ effect, durationSeconds, amplifier, chance }`).
   - **block:**
     - `hardness`, `blastResistance`, `lightLevel` (0–15), `fullCube`, `transparent`, `hasBlockEntity`, `hasBlockItem`;
     - `harvest`: `{ tool: "none" }`, or `{ tool, tier }` with tool pickaxe, axe, shovel, hoe, sword or shears;
     - `gui`: `{ hasGui: false }` or `{ hasGui: true, slots }`;
     - `drops`: `{ type: "self" }`, `{ type: "other", items }` or `{ type: "loot_table", lootTable }`;
     - `redstone`, `variants` (text).
   - **entity:**
     - for every kind: `health`, `armor`, `attackDamage`, `movementSpeed`, `size` `{ width, height }`, `drops` (`{ item, count, chance }`), `behavior`;
     - `kind`: hostile, neutral, passive, boss, projectile;
     - every kind except projectile adds `spawn` `{ dimensions, biomes, lightLevel {min, max}, groupSize {min, max} }`;
     - boss adds `bossBar` `{ color, overlay }`.
   - **structure:** `dimension`, `biomes`, `placement` `{ spacing, separation }`, `size` `{ x, y, z }`, `keyBlocks` (item IDs), `mobs` (entity IDs), `loot` (`{ item, count, chance }`).
   - **mechanic:** `category` (resource_system, progression, effect, enchantment, worldgen, other), `howItWorks`, `parameters`, `involvedEntries` (entry IDs).
   - **multiblock:**
     - `dimensions` `{ width, height, depth }` (1–16 each);
     - `layers`: `height` arrays of `width × depth` cells, each a block ID or `null`;
     - `controller` (block ID), `formationTrigger`, `function`, `inputsOutputs`, `recipeTypes` (custom recipe type IDs).
7. **Form:** shows only the fields of the current type and kind. Changing `kind`, `harvest.tool`, `gui.hasGui` or `drops.type` in a way that drops filled-in values asks for confirmation, then clears them. The schema validates on save, and errors are shown.
8. **Recipes:** only item and block entries have `recipes`. Each is one of:
   - a phase 3 visual recipe whose result is the entry, or a JSON recipe of any other type (its JSON is stored as entered and not interpreted, so its result isn't checked);
   - a custom-type recipe (requirement 13).

   Recipe slots use the designer search set.

9. **Icon:** saved as a 16×16 PNG to `assets/icons/<modid>/<path>.png`, in the same commit as the entry. The server checks the PNG signature, an IHDR of 16×16 and ≤ 16 KB.
10. **Saving:**
    - create writes `null`-SHA (create-only) paths; update sends the entry's SHA;
    - relation targets, `involvedEntries` and recipe types are checked: relation targets must exist; recipe types and machines must exist in `mod.json`;
    - a conflict reloads and shows the conflict message.
11. **Deleting:**
    - a confirmation lists the entries that reference the entry;
    - the entry file, its icon and every manual relation pointing to it in other entries are removed in **one commit**;
    - other references (ingredients, layout cells, controller, recipe-type machines) keep the ID and show it as missing.

### Custom machine recipe types (`mod.json` `recipeTypes`)

12. **Type:** `{ id, name, machine, inputs, outputs, parameters }`, where
    - `id` is snake_case and unique;
    - `machine` is a block or multiblock entry ID of this mod;
    - `inputs`: `[{ type: item | fluid | energy }]` (1–9);
    - `outputs`: `[{ type: item | fluid, chance: boolean }]` (1–9);
    - `parameters`: `{ processingTime: boolean, energyCost: boolean }`.

    A type used by recipes or multiblocks is deleted only after a confirmation that names the users.

13. **Recipe of a custom type:** `{ type: "custom", recipeType, inputs, outputs, processingTime?, energyCost? }`.
    - **Generated editor**, matching the type's slots:
      - item slots use the search modal (items or tags for inputs, items for outputs);
      - fluid slots take a fluid ID and an amount in mB; energy slots take an amount in FE;
      - outputs with `chance` take a chance from 0 to 1;
      - only the parameters the type defines are shown.
    - **Validation:** a recipe that doesn't match its type is rejected (400).

### Search sets

14. **Designer** (`GET /api/custom-mods/[modId]/search-set`): vanilla + items of the mod's declared library dependencies + all item and block entries of this mod.
15. **Pack** (extends spec 03): + item and block entries of the pack's custom mods with status `planned` or `implemented`.
16. **Icons:** entries show their drawn icon (`/api/icons/...`). Search items carry `icon: { kind: "texture" | "icon", path }` or `null`.

### Pixel editor

17. **Tools:** pencil, eraser, fill (4-neighbour flood fill), eyedropper.
    - **Color:** a color picker plus an alpha slider, and the last 12 used colors (per device).
    - **Undo/redo:** 50 steps.
18. **Canvas:**
    - transparent pixels show over a checkerboard;
    - zoom by buttons and by pinch;
    - drawing works with mouse, touch and pen;
    - usable at 380 px.
19. **Import and save:**
    - import an existing PNG: scaled to 16×16 with nearest-neighbour;
    - save produces a 16×16 PNG that is stored with the entry.

## Acceptance criteria

- [x] Schema tests:
  - every type and kind accepts its fields and rejects fields of other kinds;
  - dependent unions; kind switching clears fields; ID suggestion.
- [x] Custom recipe validation tests: slot count, slot kinds, chance, parameters.
- [x] Pixel tests: fill, history, color conversion, PNG header check.
- [x] Storage tests:
  - entry and icon in one commit, duplicate ID, invalid icon, unknown relation target or recipe type;
  - delete removes relations in one commit;
  - dependencies, recipe type create/update/delete, conflicts.
- [x] Search set tests: designer and pack sets include the right entries.
- [x] Browser check in fake mode (desktop and 380 px):
  - every type, kind switching, a multiblock layout;
  - visual and custom-type recipes, relations, delete;
  - dependencies; the pack set; the pixel editor.
- [x] `npm run check` and `npm run build` pass.

## Open questions

- None open.
