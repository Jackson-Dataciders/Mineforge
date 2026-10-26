# 0022. Designer task state

- **Status:** accepted
- **Date:** 2026-10-26
- **Refines:** [0010](0010-derived-designer-tasks.md)

## Context

ADR 0010 derives generated tasks from entry data and the current phase and stores nothing for them. The phase 5 brief adds:

- a taskboard with an In progress column;
- done generated tasks that are kept when the phase or the entry's status changes.

Neither can be computed from the entries alone. ADR 0010 also left open what completing an optimization task does.

The user decided:

- refine ADR 0010 rather than store generated tasks;
- moving a done generated task out of Done reverts the entry's status;
- manual tasks have an optional phase.

## Decision

- **Open generated tasks stay computed** from the entries and the current phase (ADR 0010).
- **Stored per-key state:** `data/custom-mods/<modid>/tasks.json` stores only per-key state, `generated: { "<rule>:<entry id>": … }`:
  - `{ column: "in_progress" }` while a task is being worked on. It counts only while the task is open. It is removed in the same commit as the phase change or entry save or delete that closes the task, and on every task write.
  - `{ column: "done", entryName, entryType }` once completed. This permanent done record keeps the name and type at completion; the rule, entry ID and phase come from the key.
- **To do** is the default and is never stored.
- **Rules:** `plan_out` (planning, backlog → planned), `implement` (implementation, planned → implemented), `polish` (optimization, implemented; **completing changes no status**, which answers 0010's open question).
- **Completing** a generated task writes the entry's new status and the done record in one commit.
- **Moving a done task out of Done** removes the record and reverts the status (planned → backlog, implemented → planned), also in one commit. It is allowed only while the task's phase is the current phase and the task is open again afterwards; otherwise the move is refused with `taskNotMovable`.
- **A done record wins over a matching condition:** if the entry's status is set back by hand, the task stays in Done instead of showing twice.
- **Manual tasks** live in the same file as `manual: [{ id, title, entryId | null, phase | null, column }]`. A task without a phase shows under every phase filter.
- **Concurrency:** every write expects the `tasks.json` SHA the client last saw and the current `mod.json` SHA, so a phase change elsewhere becomes a conflict.

## Consequences

- The board stays consistent with the entries, and completed work keeps its history across phases.
- Open tasks follow entry status changes automatically; an entry save or delete only removes stale in-progress state from `tasks.json`, in the same commit.
- Done records of deleted entries remain, showing the name at completion. They are removed only with the custom mod.

## Alternatives considered

- **Store every generated task:** duplicates entry data and goes stale (the reason for ADR 0010).
- **Keep done tasks only while their condition holds:** done tasks would vanish on every phase change, contradicting the brief.
- **Leave the status alone when un-doing a task:** the task would be open in To do while its entry already shows the advanced status.
