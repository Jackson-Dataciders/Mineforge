# 03. Modpack Planner

- **Status:** implemented
- **Date:** 2026-10-25
- **Related ADRs:** [0005](../adr/0005-direct-jar-upload-to-github.md), [0008](../adr/0008-kubejs-export.md), [0016](../adr/0016-import-non-neoforge-jars-with-warning.md), [0017](../adr/0017-library-data-format.md), [0018](../adr/0018-kubejs-script-per-recipe-change.md), [0019](../adr/0019-mod-logo-in-library-meta.md), [0020](../adr/0020-recipe-change-and-pack-task-formats.md)

## Goal

The user can see the mod library and upload jars, combine library mods and custom mods into modpacks with dependency warnings, design recipe changes visually, and export each change as a KubeJS server script from the pack's task list.

## Scope

- Library page with pending jars and direct-to-GitHub jar upload (ADR 0005).
- Mod logos in library data (extends spec 02, ADR 0019).
- Modpack mods, missing-dependency and compatibility warnings (ADR 0016).
- The shared item search modal.
- Recipe changes (add, replace, remove) with visual editors and a JSON editor.
- KubeJS script generation per recipe change (ADR 0018).
- The pack task list with KubeJS tasks and manual tasks.

## Out of scope

- Version-range checks of dependencies.
- An "export all" for a pack.
- Custom-mod entries in the search set. They join in phase 4, when entries exist.
- Editing library data, deleting jars in the app.

## Requirements

### Library (`/library`, part of the Modpack Planner view)

1. **Reaching the page:** the shell shows a "Library" link while the Modpack Planner view is active. `/library` counts as the Modpack Planner view.
2. **Library mods:** each row shows:
   - logo, name, version, mod ID, item count, inferred item count and inferred recipe count;
   - the ADR 0016 badge naming the loader or version range, if the mod is not compatible with NeoForge 1.21.1.

   A status line says whether vanilla 1.21.1 data is imported.

3. **Pending import:** jars in `jars/mods/` that no library `meta.json` references in `jarFile`.
4. **Upload jars:**
   - **Choosing files:** "Upload jars" is a multi-select file input without an `accept` filter (extension filters break on some phone browsers).
   - **Checks before upload:**
     - only `.jar` files, each ≤ 100 MB;
     - names are sanitized to `[A-Za-z0-9._+-]`;
     - a name that already exists in `jars/mods/` is rejected.
   - **Upload:**
     1. `POST /api/upload-token` returns `{ token, expiresAt, blobsUrl }`. The token is a fresh installation token, limited to this repo with `contents: write`.
     2. The browser POSTs each jar to `blobsUrl` (`git/blobs`, base64), one at a time, with per-file progress.
     3. `POST /api/jars { files: [{ name, sha }] }` commits all of them to `jars/mods/<name>` in **one commit** through the storage layer. A name that already exists is rejected (400 `jarExists`); a jar added concurrently under the same path fails the commit as a conflict (409). Nothing is ever overwritten.
   - **Fake mode:** `blobsUrl` is `/api/dev-fake/blobs`, which stores blobs in memory. That route answers 404 outside fake mode.

### Mod logo

5. **Extraction** (`tools/extract-jar.ts`):
   - **Where the logo comes from:**
     - NeoForge/Forge: the first `[[mods]]` entry's `logoFile`, else the top-level `logoFile`;
     - Fabric: `icon`. For a size map, the largest size ≤ 256, else the smallest.
   - **What is kept:** only a `.png` file that exists in the jar is copied, to `assets/textures/<modid>/_logo.png`.
   - **`meta.json`** gets `logo: "<modid>/_logo.png"` or `null`. The schema defaults it to `null`, so existing data stays valid.

### Modpacks (`/modpacks/[packId]`)

6. **Mods:** "Edit mods" opens checkbox lists of library mods (with the compatibility badge) and custom mods. Saving writes `pack.json` with its SHA through `PUT /api/modpacks/[packId]/mods`. Unknown IDs are rejected (400). `libraryModIds` accepts library mod IDs (`-` allowed).
7. **Warnings:**
   - **Missing dependency:** a `required` dependency of a pack library mod, or a dependency of a pack custom mod, that no pack library mod declares in its `modIds`.
     - `minecraft`, `neoforge`, `forge`, `fabricloader` and `java` are ignored.
     - Version ranges are not checked.
   - **Incompatible mods** (ADR 0016) are listed in a second warning.
   - **Compatibility rule:**
     - the loader must be `neoforge`;
     - the declared Minecraft range must contain 1.21.1 (Maven ranges `[a,b)`, `(,b]`, `[a]`, comma unions; a bare version is a soft requirement and matches);
     - no range counts as compatible.

### Item search modal (shared)

8. **Inputs:** items `{ id, name, icon, source, modName }`, tags (IDs), whether tags may be picked, and an `onSelect` callback. The Mod Designer reuses it in phase 4 with its own set.
9. **Search:**
   - fuzzy over the English name and the ID, ranked exact > prefix > word prefix > substring > subsequence;
   - capped at 50 results; an empty query lists the first 50 by name.
   - **Rows** show icon, name, ID, mod name and an `inferred` badge.
   - **Tags:** when they may be picked, an Items/Tags toggle switches to tags, shown as `#id`.
10. **Pack set:**
    - vanilla + the pack's library mods (+ planned/implemented entries of the pack's custom mods from phase 4);
    - served by `GET /api/modpacks/[packId]/search-set` as `{ items, tags }`.

### Recipe changes

11. **Flow** (`/modpacks/[packId]/recipe-changes/new`):
    1. Pick an item from the pack set.
    2. `GET /api/modpacks/[packId]/recipes?item=<id>` lists all vanilla and pack-library recipes whose outputs contain the item. Outputs are read from `result`, `results`, `output` and `outputs`, as a string or as `{id}`/`{item}`, recursively.
    3. Each recipe shows a read-only preview with **Replace** and **Remove**. **Add new recipe** starts from an empty editor of a chosen type.
12. **Visual editors:**
    - **Types:**
      - `crafting_shaped`: 3×3 grid;
      - `crafting_shapeless`: 1–9 ingredients;
      - `smelting`, `blasting`, `smoking`, `campfire_cooking`: ingredient, experience, cooking time. The defaults when adding are 200, 100, 100 and 600 ticks.
      - `stonecutting`;
      - `smithing_transform`: template, base, addition.
    - **Slots:**
      - Slots use the `slot` color; the selected slot has an accent outline.
      - Clicking a slot opens the search modal with items and tags.
      - A list of alternatives from an original recipe shows its first entry + "+N" and is kept until the slot is changed.
    - **Result:** always the picked item; only its count is editable.
    - **Phone:** the editor fits a 380 px screen.
13. **JSON editor:** used for every other type.
    - When replacing, it is prefilled with the original recipe JSON. A supported type that can't be shown visually (custom ingredients, result components) also opens here, with a note.
    - The JSON must be an object with a string `type`.
14. **File** `data/modpacks/<pack-id>/recipe-changes/<change-id>.json`, one of:
    - `{ id, item, itemName, action: "add", recipe }`
    - `{ id, item, itemName, action: "replace", replacedRecipeId, recipe }`
    - `{ id, item, itemName, action: "remove", removedRecipeId }`

    `recipe` is one of:
    - the visual types above, keyed by their full `type` ID; shaped stores `pattern` as 9 cells (`null` = empty);
    - `{ type: "json", data }`.

    Ingredients are `{ item }`, `{ tag }` or a list of ≥ 2 of these, as in vanilla JSON.

15. **Change ID:**
    - The item path with `/` replaced by `_`, plus `_2`, `_3`, … on collision; never `new`. It never changes.
    - The script's recipe ID is `<pack-id>:<change-id>`; the download name is `<pack-id>-<change-id>.js`.
16. **Saving:** the server reads `itemName` from the pack set and rejects items outside it.
    - **Create:** writes the change file and adds its KubeJS task, in **one commit**.
    - **Edit:** writes the change file and unchecks its task, in one commit.
    - **Delete:** removes both, in one commit.
    - The pack page lists changes with item icon, name, action and type, each linking to its editor.

### KubeJS generation

17. `generateKubeJsScript(packId, change)` is pure and deterministic. It returns a header comment plus one `ServerEvents.recipes(event => { … })` block (KubeJS 2101):
    - **Removal:** `event.remove({ id: "<recipe id>" })` for replace and remove changes.
    - **New recipe** (add/replace), ending in `.id("<pack-id>:<change-id>")`:
      - `event.shaped(result, pattern, key)`: the grid is trimmed to its used rows and columns; keys are `A`, `B`, … in reading order;
      - `event.shapeless(result, ingredients)`;
      - `event.smelting|blasting|smoking|campfireCooking(result, ingredient).xp(n).cookingTime(n)`;
      - `event.stonecutting(result, ingredient)`;
      - `event.smithing(result, template, base, addition)`;
      - JSON recipes: `event.custom({...})` with sorted keys.
    - **Values:** results are `"id"` or `"<n>x id"`; ingredients are `"id"`, `"#tag"` or arrays of these.

### Pack task list

18. **File** `data/modpacks/<pack-id>/tasks.json`: `{ tasks: [...] }` with:
    - `{ id, type: "manual", title, done }`, or
    - `{ id, type: "kubejs", recipeChangeId, done }`.

    A missing file means no tasks. A KubeJS task's title is the UI string "Write KubeJS: {item}" with the change's `itemName`.

19. **Behavior:**
    - Add a manual task; check and uncheck any task.
    - Open tasks come first; done tasks are greyed out at the bottom. Both keep stored order, so unchecking restores the position.
    - Manual tasks can be deleted; KubeJS tasks are removed with their change.
20. **Export script:** a link on KubeJS tasks to `GET /api/modpacks/[packId]/recipe-changes/[changeId]/script`, which answers `text/javascript` with `Content-Disposition: attachment; filename="<pack-id>-<change-id>.js"`.
21. **Concurrency:** every task write sends the `tasks.json` SHA. On a conflict the client reloads and shows the conflict message.

## Acceptance criteria

- [x] KubeJS generator tests:
  - one case per type: shaped (trim, tags, alternatives), shapeless, smelting, blasting, smoking, campfire cooking, stonecutting, smithing, JSON;
  - replace, remove-only, counts, deterministic output.
- [x] Domain tests:
  - recipe parsing from vanilla-shaped JSON and its fallbacks;
  - output detection, change IDs;
  - task operations and order;
  - Maven ranges and compatibility, missing dependencies;
  - fuzzy ranking, jar names.
- [x] Storage tests:
  - change + task in one commit; edit reopens the task; delete removes both; conflicts;
  - jar commit from blob SHAs, an existing name, an unknown blob;
  - library listing and pending jars.
- [x] Extraction tests: NeoForge `logoFile`, Fabric icon map, missing or non-PNG logo.
- [x] Browser check in fake mode (desktop and 380 px):
  - library;
  - upload of two jars as one commit;
  - pack mods and warnings;
  - replace, add, remove and JSON changes; edit and delete;
  - task order, script download.
- [x] `npm run check` and `npm run build` pass.

## Open questions

- None open.
