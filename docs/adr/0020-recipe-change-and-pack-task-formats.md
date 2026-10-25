# 0020. Recipe change and pack task formats

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The phase 3 brief requires these behaviours:

- each recipe change is its own file;
- saving a change creates the pack task "Write KubeJS: <output item name>";
- the task exports that change as a script.

The brief does not fix the file shapes, the change IDs, or how a change and its task stay consistent. The user decided three further points:

- a change can also just remove a recipe;
- changes can be edited and deleted;
- manual tasks can be deleted.

ADR 0008 requires that change files hold everything the export needs.

## Decision

- **Recipe change file** `data/modpacks/<pack-id>/recipe-changes/<change-id>.json`. It is a Zod discriminated union on `action`:
  - `add` with `recipe`;
  - `replace` with `replacedRecipeId` and `recipe`;
  - `remove` with `removedRecipeId`.

  Every change stores `item` (the output item ID) and `itemName` (English, copied from library data when saved).

- **Recipe:** a discriminated union on `type`:
  - the visual types (`minecraft:crafting_shaped`, `crafting_shapeless`, `smelting`, `blasting`, `smoking`, `campfire_cooking`, `stonecutting`, `smithing_transform`) with typed fields;
  - `"json"` with the raw recipe object.

  Ingredients keep vanilla's JSON shape (`{item}`, `{tag}` or a list). For visual types, the result item must equal `item`.

- **Change ID:** derived from the item path (`/` → `_`), with `_2`, `_3`, … on collision; never `new`. It is immutable and is also the KubeJS slug: recipe ID `<pack-id>:<change-id>`, file name `<pack-id>-<change-id>.js`.
- **Pack tasks** in `data/modpacks/<pack-id>/tasks.json`: `{ tasks: [...] }`. Each task is a discriminated union on `type`:
  - `manual`: `title`;
  - `kubejs`: `recipeChangeId`.

  Both have `id` and `done`. A KubeJS task's title is rendered from an i18n string and the change's `itemName`; it is not stored.

- **Consistency:** each of these is one atomic commit, with expected SHAs for both files:
  - creating a change writes the change file and adds its KubeJS task;
  - editing a change writes the change file and unchecks its task;
  - deleting a change removes the file and the task.

## Consequences

- Scripts can be generated from one change file alone.
- Item names in tasks and lists need no library lookup; a later re-import does not rename existing changes.
- Every pack task write goes through `tasks.json`'s SHA, so two quick edits from different devices conflict instead of overwriting each other.
- The glossary gains "KubeJS task", and modpacks now have generated KubeJS tasks next to manual tasks.

## Alternatives considered

- **Storing the task title as text:** it would freeze the UI language into data. Rejected because UI strings must stay translatable.
- **Random change IDs:** these are always unique, but they make file names and recipe IDs meaningless in the game and in git diffs.
- **Separate commits for the change and its task:** a failure between them would leave a change without a task.
