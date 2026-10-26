# 0010. Designer tasks are derived from data

- **Status:** accepted (task state refined by [0022](0022-designer-task-state.md))
- **Date:** 2026-10-25

## Context

The Mod Designer taskboard should reflect what is actually missing in a custom mod's entries, without the user maintaining a task list by hand. Stored generated tasks would go stale when entries change.

## Decision

- Generated tasks are computed by pure rules in `src/domain/` (planned) from a custom mod's entries and its current phase. They are not stored.
- Each generated task has a stable key `<rule-id>:<entry-id>`. The key stays the same across recomputation, so UI state and completion can refer to it.
- Only rules for the custom mod's **current phase** (planning / implementation / optimization) produce tasks.
- Completing a generated task advances the entry's status: backlog → planned in the planning phase, planned → implemented in the implementation phase. A task whose condition no longer holds disappears.
- Manual tasks are stored in `data/custom-mods/<modid>/tasks.json` with their own IDs.

## Consequences

- The taskboard is always consistent with the data; rules are unit-testable.
- `tasks.json` may store per-key state for generated tasks (e.g. dismissed). The Designer spec defines this.
- **Open question for the Designer spec:** what completing an optimization-phase task does, since entries are already implemented.

## Alternatives considered

None were listed when the decision was made.
