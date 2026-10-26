# 06. Mind map

- **Status:** implemented
- **Date:** 2026-10-26
- **Related ADRs:** [0023](../adr/0023-mind-map-graph-and-layout.md), [0021](../adr/0021-entry-and-custom-recipe-type-formats.md), [0011](../adr/0011-theming-semantic-tokens.md)

## Goal

Each custom mod has a mind map that shows its entries and how they connect, from recipes, manual relations and the links the entries imply. You can arrange it, and the arrangement is kept.

## Scope

- A graph derived from the entries: entry nodes, optional outside item nodes, five kinds of edges.
- ELK auto-layout, dragging with automatic saving to `layout.json`, and a re-layout button.
- Filters for entry types, statuses, edge kinds and outside items.

## Out of scope

- Creating or editing relations on the map (they stay in the entry form).
- Grouping or clustering nodes, and exporting the map.

## Requirements

### Graph (`src/domain/mind-map.ts`, pure)

1. **Nodes:**
   - one per entry of the mod;
   - one per outside item (vanilla, library or missing) used as a recipe ingredient. Outside items show only with the "Outside items" filter on (off by default) and while they have a visible edge.
2. **Edges.** Edges to entries that no longer exist are dropped.

   | Kind                                                                             | Direction                             | From                                                                                                   | Look                                                                             |
   | -------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
   | `ingredient_of`                                                                  | ingredient → entry                    | item/block recipes (every item alternative, no tags; raw JSON recipes give none); custom recipe inputs | muted, unlabeled                                                                 |
   | `drops_from`, `part_of_multiblock`, `generated_in_structure`, `powers`, `custom` | source → target                       | manual relations                                                                                       | accent, labeled (custom: its label); each type has its own dash pattern or width |
   | `part_of_multiblock` (derived)                                                   | cell or controller entry → multiblock | multiblock layers and controller                                                                       | secondary, dashed, labeled                                                       |
   | `made_in`                                                                        | product → machine                     | custom recipes and their type's machine                                                                | secondary, dashed, labeled                                                       |
   | `involved_in`                                                                    | entry → mechanic                      | mechanic involved entries                                                                              | secondary, dashed, labeled                                                       |

3. **Merging:** the edge ID is `<kind>:[<label>:]<source>-><target>`, so duplicates merge. A manual relation wins over the same derived link.

### Nodes

4. **Entry node** (208×64):
   - shows the entry icon (or a placeholder), the name, the `StatusIcon` and the type;
   - has an "Open" link button (44 px) to the entry form; tapping or clicking the node also opens it.
   - **Touch screens** (coarse pointer): nodes can't be dragged by accident while panning; a **Move nodes** toggle in the controls turns dragging on.

   **Outside item node** (176×48): icon, name and mod name. A danger border marks an item that is missing from the designer's item set.

### Layout (`data/custom-mods/<modid>/layout.json`)

5. **File format:** `{ positions: { "<node id>": { x, y } } }`, integers, at most 2000 positions. A missing file means no positions.
6. **Opening the map:**
   - If no visible node has a stored position, ELK (`layered`, left to right) lays out the visible graph in the browser. Nothing is saved until you drag or re-layout.
   - Nodes without a stored position (e.g. new entries, or outside items when their filter is turned on) are laid out with ELK among themselves and placed right of the stored layout (`placeBeside`). The column placement (`placeUnpositioned`) is only the fallback if ELK fails.
7. **Saving after a drag:** about 800 ms after a drag, all shown positions are saved (`PUT /api/custom-mods/[modId]/layout` with the `layout.json` SHA).
   - Only one save runs at a time; moves made during a save are sent next.
   - A conflict reloads the map.
   - A save still waiting for its timer is sent at once when the page is hidden (through the queue) or left (`keepalive`, or a normal request for bodies over 60 KB).
   - The server rounds coordinates and drops IDs that are no longer nodes.
8. **Re-layout:** asks for confirmation, then lays out the visible graph with ELK and saves. Hidden nodes keep their positions.

### Page

9. **Page:** `/designer/[modId]/map`, reached through the **Mind map** tab next to Entries and Taskboard.
   - The canvas fills the viewport below the header and supports touch pan and pinch zoom.
   - Zoom in, zoom out, fit view (never beyond 100 %) and Re-layout are 44 px controls.
10. **Filters:** a collapsible panel (collapsed by default) with:
    - entry types, statuses, edge kinds (each with a line sample) and outside items;
    - a "Reset filters" button;
    - the number of entries the filters hide in its summary (outside items are not counted).

    The filters are remembered per device (`localStorage` `mf-map-filters`; blocked storage falls back to memory). An empty result or a mod without entries shows a hint.

11. **Accessibility:** a visually hidden list names every visible edge ("Gear – Powers → Smelter"); xyflow's screen-reader texts are replaced with en/de strings for the read-only map; a missing outside item says so in text.

12. **Theming:**
    - only xyflow's `base.css` is loaded, and its CSS variables map to theme tokens in `globals.css`;
    - nodes use `surface`; edges use role colors on `bg` (tested 3:1 pairs); labels are `text` on `surface`.

## Acceptance criteria

- [x] Domain tests: every edge kind, merging, dropped targets, outside items, filters, sanitizing and placement (`src/domain/mind-map.test.ts`).
- [x] Storage tests: save with rounding and pruning, SHA conflicts, unknown mod (`src/storage/layout.test.ts`).
- [x] Browser (dev-fake):
  - the first view is laid out;
  - a drag saves once and survives a reload;
  - re-layout asks first;
  - the type and outside-item filters work;
  - Open links point to the entries;
  - relation labels show;
  - light and dark modes work;
  - at 375 px: 44 px controls, collapsed filters, no page overflow.

## Open questions

- None. Decisions are in ADR 0023.
