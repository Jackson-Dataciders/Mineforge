# 0018. One KubeJS script per recipe change

- **Status:** accepted
- **Date:** 2026-10-25
- **Supersedes in part:** [0008](0008-kubejs-export.md) (its "one script per pack" point)

## Context

ADR 0008 exports all of a pack's recipe changes as one KubeJS server script. The phase 3 brief instead ties export to individual recipe changes:

- a pure function turns **one recipe change** into a KubeJS server script;
- saving a recipe change creates the pack task "Write KubeJS: <output item name>";
- that task's "Export script" button downloads the script for its recipe change as a `.js` file.

KubeJS loads every `.js` file under `kubejs/server_scripts/`, subfolders included, and each file may contain its own `ServerEvents.recipes` handler. So per-change files work in the game. The user chose the brief's per-change export.

## Decision

- **Generator:** a pure function in `src/domain/` takes one recipe change plus the data it references and returns one complete server script containing a single `ServerEvents.recipes(event => { ... })` block. It contains:
  - `event.remove({ id: '<original recipe id>' })` when the change replaces an existing recipe;
  - then the new recipe, ending in `.id('<pack-id>:<slug>')`;
  - recipe types without a KubeJS shorthand (modded types) as `event.custom({...})` with the recipe JSON.
- **Download:** the pack task's "Export script" button downloads the script.
  - The file name is stable per recipe change (derived from the pack ID and the change's slug, defined in the phase 3 spec), so re-exporting replaces the old file instead of adding a second copy.
  - The user places it under `kubejs/server_scripts/`.
- **Rules from ADR 0008 that still apply:** pure function, no I/O, deterministic output, and recipe change files hold everything the export needs.
- **Tests:** unit tests cover one case per supported recipe type, as required by the brief.
- **Version check:** the KubeJS recipe event syntax for 1.21.1 (KubeJS 2101.x) is checked against its documentation or source in phase 3, before the generator is built.

## Consequences

- Export fits the task workflow: write the script, check off the task.
- A pack with many changes means many small files, one download each. There is no combined "export all"; it could reuse this generator if requested later.
- Because modded types go through `event.custom`, no recipe type needs an "unsupported" comment anymore (that point of ADR 0008 no longer applies).

## Alternatives considered

- **One script per pack** (ADR 0008 as written): easier to drop into a pack in one go, but it doesn't match the per-task "Export script" button. The user rejected it.
