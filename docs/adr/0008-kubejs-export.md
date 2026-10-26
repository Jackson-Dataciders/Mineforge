# 0008. Modpack recipe changes are exported as KubeJS server scripts

- **Status:** accepted ("one script per pack" superseded by [0018](0018-kubejs-script-per-recipe-change.md): one script per recipe change)
- **Date:** 2026-10-25

## Context

Recipe changes designed in the Modpack Planner must be applied in the game. KubeJS is the common way for modpacks on 1.21.1 to add, remove and replace recipes.

## Decision

- A pack's recipe changes are exported as one KubeJS (1.21.1) server script, for `kubejs/server_scripts/`, using `ServerEvents.recipes(event => { ... })`.
- The export is a **pure function** in `src/domain/`: recipe changes plus referenced item data in, script text out. It does no I/O.
- It is unit-tested with fixed inputs and expected script output.
- Output is deterministic: changes in a stable order, so re-exports diff cleanly.

## Consequences

- The export can run in the browser or on the server and is trivially testable.
- Recipe change files must hold everything the export needs (IDs, ingredients, counts, tags); the export must not look anything up.
- Unsupported recipe types produce an explicit comment in the script, never a silent skip.

## Alternatives considered

None were listed when the decision was made.
