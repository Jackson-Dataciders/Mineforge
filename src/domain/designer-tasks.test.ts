import { describe, expect, it } from "vitest";
import {
  addManualTask,
  boardTasks,
  designerTasksSchema,
  EMPTY_DESIGNER_TASKS,
  matchesPhase,
  moveGenerated,
  moveManualTask,
  parseTaskKey,
  pruneGenerated,
  removeManualTask,
  taskKey,
  type DesignerTasks,
  type ManualTask,
  type TaskEntry,
} from "./designer-tasks";

const gear: TaskEntry = {
  id: "demo:gear",
  name: "Gear",
  type: "item",
  status: "backlog",
};
const press: TaskEntry = {
  id: "demo:press",
  name: "Press",
  type: "block",
  status: "planned",
};
const heat: TaskEntry = {
  id: "demo:heat",
  name: "Heat",
  type: "mechanic",
  status: "implemented",
};
const entries = [gear, press, heat];

const summary = (
  state: DesignerTasks,
  list = entries,
  phase = "planning" as const,
) =>
  boardTasks(list, phase, state).map((c) =>
    c.kind === "generated"
      ? `${c.column} ${c.key}`
      : `${c.column} ${c.task.id}`,
  );

const manual = (patch: Partial<ManualTask> = {}): ManualTask => ({
  id: "m1",
  title: "Write the wiki page",
  entryId: null,
  phase: null,
  column: "to_do",
  ...patch,
});

describe("task keys", () => {
  it("round-trips rule and entry ID", () => {
    expect(taskKey("plan_out", "demo:gear")).toBe("plan_out:demo:gear");
    expect(parseTaskKey("plan_out:demo:gear")).toEqual({
      rule: "plan_out",
      entryId: "demo:gear",
    });
    expect(parseTaskKey("other:demo:gear")).toBeNull();
    expect(parseTaskKey("polish:gear")).toBeNull();
    expect(parseTaskKey("toString:demo:gear")).toBeNull();
  });

  it("validates tasks.json", () => {
    const state = {
      manual: [manual()],
      generated: {
        "plan_out:demo:gear": { column: "in_progress" },
        "implement:demo:press": {
          column: "done",
          entryName: "Press",
          entryType: "block",
        },
      },
    };
    expect(designerTasksSchema.parse(state)).toEqual(state);
    expect(designerTasksSchema.parse({})).toEqual(EMPTY_DESIGNER_TASKS);
    expect(
      designerTasksSchema.safeParse({
        generated: { "x:demo:gear": { column: "in_progress" } },
      }).success,
    ).toBe(false);
    expect(
      designerTasksSchema.safeParse({ manual: [manual(), manual()] }).success,
    ).toBe(false);
  });
});

describe("generated tasks", () => {
  it("are derived only for the current phase", () => {
    expect(summary(EMPTY_DESIGNER_TASKS)).toEqual(["to_do plan_out:demo:gear"]);
    expect(
      boardTasks(entries, "implementation", EMPTY_DESIGNER_TASKS).map(
        (c) => c.kind === "generated" && c.key,
      ),
    ).toEqual(["implement:demo:press"]);
    expect(
      boardTasks(entries, "optimization", EMPTY_DESIGNER_TASKS).map(
        (c) => c.kind === "generated" && c.key,
      ),
    ).toEqual(["polish:demo:heat"]);
  });

  it("carry the entry name, type and phase", () => {
    const [boardTask] = boardTasks(entries, "planning", EMPTY_DESIGNER_TASKS);
    expect(boardTask).toMatchObject({
      kind: "generated",
      rule: "plan_out",
      entryName: "Gear",
      entryType: "item",
      phase: "planning",
      entry: gear,
    });
  });

  it("show stored in-progress state while open, and ignore stale state", () => {
    const state: DesignerTasks = {
      manual: [],
      generated: {
        "plan_out:demo:gear": { column: "in_progress" },
        "implement:demo:press": { column: "in_progress" },
      },
    };
    expect(summary(state)).toEqual(["in_progress plan_out:demo:gear"]);
    // The entry's status changed: the open task disappears.
    expect(summary(state, [{ ...gear, status: "planned" }])).toEqual([]);
    expect(pruneGenerated(state, entries, "planning").generated).toEqual({
      "plan_out:demo:gear": { column: "in_progress" },
    });
    expect(
      pruneGenerated(state, [{ ...gear, status: "planned" }, press], "planning")
        .generated,
    ).toEqual({});
  });

  it("keep done records after status, phase and entry changes", () => {
    const done = moveGenerated(
      EMPTY_DESIGNER_TASKS,
      "plan_out:demo:gear",
      "done",
      gear,
      "planning",
    )!;
    expect(done.status).toBe("planned");
    const planned = { ...gear, status: "planned" as const };
    expect(summary(done.state, [planned, press, heat])).toEqual([
      "done plan_out:demo:gear",
    ]);
    // Another phase: the done task stays, the new phase's tasks appear.
    expect(
      boardTasks([planned, press], "implementation", done.state).map(
        (c) => `${c.column} ${c.kind === "generated" ? c.key : ""}`,
      ),
    ).toEqual([
      "to_do implement:demo:gear",
      "to_do implement:demo:press",
      "done plan_out:demo:gear",
    ]);
    // Deleted entry: the name and type at completion are kept.
    const [boardTask] = boardTasks([], "planning", done.state);
    expect(boardTask).toMatchObject({
      column: "done",
      entryName: "Gear",
      entryType: "item",
      entry: null,
    });
    expect(pruneGenerated(done.state, [], "optimization")).toEqual(done.state);
  });

  it("show a done task once even if its condition holds again", () => {
    const done = moveGenerated(
      EMPTY_DESIGNER_TASKS,
      "plan_out:demo:gear",
      "done",
      gear,
      "planning",
    )!;
    expect(summary(done.state)).toEqual(["done plan_out:demo:gear"]);
  });
});

describe("moving generated tasks", () => {
  const key = "plan_out:demo:gear";

  it("changes only state between To do and In progress", () => {
    const started = moveGenerated(
      EMPTY_DESIGNER_TASKS,
      key,
      "in_progress",
      gear,
      "planning",
    )!;
    expect(started).toEqual({
      state: { manual: [], generated: { [key]: { column: "in_progress" } } },
      status: null,
    });
    const back = moveGenerated(started.state, key, "to_do", gear, "planning")!;
    expect(back).toEqual({ state: EMPTY_DESIGNER_TASKS, status: null });
  });

  it("advances the status on completion, except for polish", () => {
    expect(
      moveGenerated(
        EMPTY_DESIGNER_TASKS,
        "implement:demo:press",
        "done",
        press,
        "implementation",
      )?.status,
    ).toBe("implemented");
    const polished = moveGenerated(
      EMPTY_DESIGNER_TASKS,
      "polish:demo:heat",
      "done",
      heat,
      "optimization",
    )!;
    expect(polished.status).toBeNull();
    expect(polished.state.generated["polish:demo:heat"]).toEqual({
      column: "done",
      entryName: "Heat",
      entryType: "mechanic",
    });
  });

  it("reverts the status when a done task leaves Done", () => {
    const done = moveGenerated(
      EMPTY_DESIGNER_TASKS,
      key,
      "done",
      gear,
      "planning",
    )!;
    const planned = { ...gear, status: "planned" as const };
    expect(
      moveGenerated(done.state, key, "to_do", planned, "planning"),
    ).toEqual({
      state: EMPTY_DESIGNER_TASKS,
      status: "backlog",
    });
    expect(
      moveGenerated(done.state, key, "in_progress", planned, "planning"),
    ).toEqual({
      state: { manual: [], generated: { [key]: { column: "in_progress" } } },
      status: "backlog",
    });
    // Already back in backlog (edited by hand): only the record goes.
    expect(
      moveGenerated(done.state, key, "to_do", gear, "planning")?.status,
    ).toBeNull();
    // Polish keeps the status.
    const polished = moveGenerated(
      EMPTY_DESIGNER_TASKS,
      "polish:demo:heat",
      "done",
      heat,
      "optimization",
    )!;
    expect(
      moveGenerated(
        polished.state,
        "polish:demo:heat",
        "to_do",
        heat,
        "optimization",
      ),
    ).toEqual({ state: EMPTY_DESIGNER_TASKS, status: null });
  });

  it("refuses moves that don't fit the phase, entry or status", () => {
    const done = moveGenerated(
      EMPTY_DESIGNER_TASKS,
      key,
      "done",
      gear,
      "planning",
    )!;
    const planned = { ...gear, status: "planned" as const };
    // Done task of another phase.
    expect(
      moveGenerated(done.state, key, "to_do", planned, "implementation"),
    ).toBeNull();
    // Entry deleted, or moved on to implemented.
    expect(
      moveGenerated(done.state, key, "to_do", null, "planning"),
    ).toBeNull();
    expect(
      moveGenerated(
        done.state,
        key,
        "to_do",
        { ...gear, status: "implemented" },
        "planning",
      ),
    ).toBeNull();
    // Open task whose status no longer matches, or of another phase.
    expect(
      moveGenerated(EMPTY_DESIGNER_TASKS, key, "done", planned, "planning"),
    ).toBeNull();
    expect(
      moveGenerated(EMPTY_DESIGNER_TASKS, key, "done", gear, "implementation"),
    ).toBeNull();
    // Wrong entry or malformed key.
    expect(
      moveGenerated(EMPTY_DESIGNER_TASKS, key, "done", press, "planning"),
    ).toBeNull();
    expect(
      moveGenerated(EMPTY_DESIGNER_TASKS, "nope", "done", gear, "planning"),
    ).toBeNull();
  });
});

describe("manual tasks", () => {
  it("are added, moved and removed", () => {
    const one = addManualTask(EMPTY_DESIGNER_TASKS, manual());
    const two = addManualTask(
      one,
      manual({ id: "m2", entryId: "demo:press", phase: "implementation" }),
    );
    const moved = moveManualTask(two, "m2", "done");
    expect(summary(moved)).toEqual([
      "to_do plan_out:demo:gear",
      "to_do m1",
      "done m2",
    ]);
    const boardTask = boardTasks(entries, "planning", moved).find(
      (c) => c.kind === "manual" && c.task.id === "m2",
    );
    expect(boardTask?.entry).toEqual(press);
    expect(removeManualTask(moved, "m2").manual.map((t) => t.id)).toEqual([
      "m1",
    ]);
  });

  it("show a deleted linked entry as missing", () => {
    const state = addManualTask(
      EMPTY_DESIGNER_TASKS,
      manual({ entryId: "demo:gone" }),
    );
    const boardTask = boardTasks(entries, "planning", state).find(
      (c) => c.kind === "manual",
    );
    expect(boardTask?.entry).toBeNull();
  });
});

describe("phase filter", () => {
  it("shows tasks without a phase under every filter", () => {
    const state = addManualTask(
      addManualTask(EMPTY_DESIGNER_TASKS, manual()),
      manual({ id: "m2", phase: "optimization" }),
    );
    const visible = boardTasks(entries, "planning", state);
    const ids = (filter: Parameters<typeof matchesPhase>[1]) =>
      visible
        .filter((c) => matchesPhase(c, filter))
        .map((c) => (c.kind === "manual" ? c.task.id : c.key));
    expect(ids("all")).toEqual(["plan_out:demo:gear", "m1", "m2"]);
    expect(ids("planning")).toEqual(["plan_out:demo:gear", "m1"]);
    expect(ids("optimization")).toEqual(["m1", "m2"]);
  });
});
