# 0023. Mind map graph and layout

- **Status:** accepted
- **Date:** 2026-10-26

## Context

Phase 6 adds a mind map per custom mod. The brief fixes the libraries (xyflow, elkjs), the node content, "ingredient of" edges from recipes, labeled edges for manual relations, an auto-layout with positions in `layout.json`, a re-layout button and filters. Several hard-to-reverse points were open:

- what is stored;
- which other links between entries become edges;
- whether items outside the mod appear;
- how positions are saved.

The user decided:

- outside items appear only through a filter that is off by default;
- the links the entries already imply become filterable edges;
- positions save automatically after a drag.

## Decision

- **Nothing about the graph is stored except node positions.** Nodes and edges are computed by a pure function (`buildMindMap` in `src/domain/mind-map.ts`) from the entries and the mod's custom recipe types, like generated tasks (ADR 0010).
- **Nodes:** one per entry, plus one per outside item (vanilla, library or missing) used as a recipe ingredient. Node IDs are the entry or item IDs.
- **Edge kinds:**
  - `ingredient_of` (ingredient → entry): from item/block recipes, every item alternative (no tags; raw JSON recipes are not parsed for edges), and custom recipe inputs only;
  - the manual relation types (`drops_from`, `part_of_multiblock`, `generated_in_structure`, `powers`, `custom` with its label), source → target;
  - `part_of_multiblock`, also derived from multiblock cells and the controller (cell entry → multiblock);
  - `made_in` (product → the machine of the custom recipe's type);
  - `involved_in` (entry → mechanic, from `involvedEntries`).
- **Merging:** an edge's ID is `<kind>:[<label>:]<source>-><target>`. A manual relation and a derived link with the same ID become one manual edge.
- **Missing entries:** edges to entries that no longer exist are dropped.
- **`data/custom-mods/<modid>/layout.json`:** `{ positions: { "<node id>": { x, y } } }`, integers, at most 2000 positions.
  - A missing file means no positions.
  - The server rounds coordinates and drops IDs that are no longer nodes on every save.
- **Layout:**
  - **First view:** with no stored position for any visible node, ELK (`layered`, left to right) lays out the visible graph in the browser. The result isn't saved until the user drags or re-layouts.
  - **New nodes** are placed deterministically in a column right of the stored layout.
  - **Re-layout** replaces the positions of the visible nodes after a confirmation. Hidden nodes keep theirs.
- **Saving:** about 800 ms after a drag, the full position map is saved with the `layout.json` SHA (one request at a time; later moves are sent next). A conflict reloads. A save that changes nothing is not written; a move still waiting for its timer is sent with `keepalive` when the page is left.
- **Libraries:** `@xyflow/react` 12.12.0 and `elkjs` 0.12.0, pinned exactly.
  - ELK is loaded on demand in the browser.
  - Only xyflow's structural `base.css` is used; its CSS variables map to the theme tokens (ADR 0011).
  - Nodes have fixed sizes and handle positions, so neither ELK nor the edges wait for DOM measuring.

## Consequences

- The map always matches the entries. Edge rules are unit-testable, and new edge kinds need no migration.
- Each drag is a commit to the data repo. Data commits don't trigger Vercel builds (ADR 0002).
- Removing an entry leaves its position in `layout.json` until the next save prunes it; it is never shown.
- Relations are still edited only in the entry form; the map is read-only apart from positions.

## Alternatives considered

- **Store edges or the full graph:** duplicates entry data and goes stale.
- **Always show outside items:** busy maps for mods with many vanilla ingredients.
- **A "Save layout" button:** extra step, and unsaved moves are lost on navigation.
- **Server-side ELK:** adds work to every page view; the browser lays out only when needed.
