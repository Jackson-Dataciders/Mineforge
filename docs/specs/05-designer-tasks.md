# 05. Designer tasks and taskboard

- **Status:** implemented
- **Date:** 2026-10-26
- **Related ADRs:** [0010](../adr/0010-derived-designer-tasks.md), [0022](../adr/0022-designer-task-state.md), [0011](../adr/0011-theming-semantic-tokens.md)

## Goal

Each custom mod has a current phase and a taskboard. Tasks generated from the entries' statuses show what is left in that phase, next to manual tasks. Completing a generated task advances its entry.

## Scope

- Setting the custom mod's current phase.
- Generated tasks per phase, with stable keys and permanent done records.
- Manual tasks with an optional linked entry and an optional phase.
- A taskboard (To do / In progress / Done) with drag and drop, touch-friendly move buttons and a phase filter.
- Entry status icons in lists, the item search modal and on tasks on the taskboard.

## Out of scope

- Reordering tasks within a column, due dates, assignees.
- The mind map (phase 6; it reuses the status icon).
- Editing a manual task's title, entry or phase after creating it (delete and re-create).

## Requirements

### Phase

1. The custom mod pages share a header with the name, the ID, a **Current phase** select (planning / implementation / optimization) and **Entries | Taskboard** tabs. Choosing a phase shows **Change phase** and **Cancel**; only the button applies it (keyboard browsing of the select changes nothing). It writes `mod.json` `phase` with its SHA (`PUT /api/custom-mods/[modId]/phase`), prunes stale in-progress state in the same commit, and reloads the page data.

### Generated tasks

2. Pure rules in `src/domain/designer-tasks.ts` apply only in the mod's current phase. Each task has the stable key `<rule>:<entry id>`.

   | Rule        | Phase          | Condition            | Title (i18n)                    | Completing      |
   | ----------- | -------------- | -------------------- | ------------------------------- | --------------- |
   | `plan_out`  | planning       | status `backlog`     | "Plan out {type}: {name}"       | → `planned`     |
   | `implement` | implementation | status `planned`     | "Implement {type}: {name}"      | → `implemented` |
   | `polish`    | optimization   | status `implemented` | "Balance/polish {type}: {name}" | no change       |

3. Open tasks (To do, In progress) are recomputed from the entries and the phase. When the phase changes or an entry's status stops matching, the open task disappears. Its in-progress state is removed in the same commit as the phase change or entry save or delete (and on every task write), so a task that becomes open again starts in To do.
4. Done tasks are kept as records (ADR 0022) and show after status changes, phase changes and entry deletion, with the entry's name and type at completion. A done record wins over a condition that holds again, so a task never shows twice.
5. **Moving a generated task:**
   - **To do ↔ In progress:** only `tasks.json` changes.
   - **→ Done:** the entry status advances per the table, and the done record is written, in one commit.
   - **Done → To do / In progress:** the record is removed and the status reverts (`planned` → `backlog`, `implemented` → `planned`; polish keeps it), in one commit.
   - **Refusals:** a move is refused with `taskNotMovable` if the task's phase isn't the current phase, the entry is gone, or the status no longer fits. Then the board reloads. Tasks show only the moves that are possible; a done task with none says why (done in another phase, entry deleted, or status changed).

### Manual tasks

6. Manual tasks are created with a title (1–200 characters), an optional linked entry of this mod (`unknownEntry` otherwise) and an optional phase. They start in To do, move freely, and can be deleted. Completing one changes nothing else. A linked entry that was deleted shows as missing.

### Storage

7. `data/custom-mods/<modid>/tasks.json`: `{ manual: [...], generated: { "<key>": { column: "in_progress" } | { column: "done", entryName, entryType } } }` (Zod: `designerTasksSchema`). A missing file means no state.
   - Every write sends the `tasks.json` SHA last seen (`null` if missing) and expects the current `mod.json` SHA. A conflict reloads the board.
   - A write that changes nothing is skipped.
8. **Routes:**
   - `POST /api/custom-mods/[modId]/tasks` (manual task);
   - `POST …/tasks/move` (`{ kind: "generated", key } | { kind: "manual", id }` with `column` and `sha`; it returns the tasks and any changed entry status);
   - `DELETE …/tasks/[taskId]` (manual task).

### Taskboard

9. `/designer/[modId]/tasks` shows three columns: To do, In progress and Done. They sit side by side from `md` and are stacked on phones.
   - **Task contents:** the title, "Generated" for generated tasks, the phase, and the linked entry with its status icon (a link to the entry form).
   - **Done tasks:** the title is muted and struck through.
10. **Moving tasks:**
    - **Drag and drop:** native HTML5 between columns.
    - **Move buttons:** every task also has a button per possible target column (touch-friendly, ≥ 44 px), so phones never need dragging.
11. **Phase filter:** All phases / one phase, remembered per device (`localStorage` `mf-task-phase-filter`; blocked storage falls back to memory). Tasks without a phase show under every filter.
12. **New task form:** title, linked entry (None or one of the mod's entries) and phase (Any phase or one phase).

### Status icons

13. `StatusIcon`:
    - **Icons:** backlog = muted circle, planned = secondary dotted circle, implemented = ok check circle. The accessible name is the status.
    - **Contrast:** the icon sits on a surface base, so it keeps its contrast on hovered rows (ADR 0011). Inside its own tint it has no base.
    - **Where it shows:** the mod page entry list (inside the status pill), the involved-entries checkbox list, entry rows in the item search modal, tasks on the taskboard, item lists (key blocks, drops, loot), recipe and multiblock slots holding an entry, the entry delete dialog's reference list and the recipe type delete dialog's user list. Native selects (relation target, task entry) can't show icons.

## Acceptance criteria

- [x] Rules, keys, done records, pruning, completion and revert are covered by unit tests (`src/domain/designer-tasks.test.ts`).
- [x] Storage tests: atomic entry + tasks commits, revert, refusals, stale SHA and concurrent phase-change conflicts, pruning, manual task create/move/delete, no-op writes (`src/storage/designer-tasks.test.ts`).
- [x] Browser (dev-fake):
  - a phase switch changes the open tasks;
  - completing "Plan out" sets the entry to planned and keeps the task in Done;
  - switching to implementation shows "Implement" next to the done task;
  - Done → To do reverts the status;
  - In progress disappears when the status changes in the entry form;
  - manual tasks with and without a phase work with the filter;
  - drag and drop works on desktop and the move buttons at 380 px;
  - status icons show in lists and the search modal.

## Open questions

- None. The decisions are in ADR 0022.
