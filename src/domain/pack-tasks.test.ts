import { describe, expect, it } from "vitest";
import {
  addKubeJsTask,
  addManualTask,
  EMPTY_PACK_TASKS,
  orderTasks,
  packTasksSchema,
  removeTask,
  removeTasksForChange,
  reopenTaskForChange,
  setTaskDone,
  taskForChange,
} from "./pack-tasks";

describe("pack tasks", () => {
  const list = addKubeJsTask(
    addManualTask(EMPTY_PACK_TASKS, "a1", "  Test the pack  "),
    "b2",
    "iron_pickaxe",
  );

  it("adds manual and KubeJS tasks", () => {
    expect(list.tasks).toEqual([
      { id: "a1", type: "manual", title: "Test the pack", done: false },
      { id: "b2", type: "kubejs", recipeChangeId: "iron_pickaxe", done: false },
    ]);
    expect(packTasksSchema.parse(list)).toEqual(list);
    expect(addKubeJsTask(list, "c3", "iron_pickaxe")).toBe(list);
  });

  it("orders open tasks first, then done tasks, each in stored order", () => {
    const three = addManualTask(list, "c3", "Third");
    const done = setTaskDone(three, "a1", true);
    expect(orderTasks(done.tasks).map((t) => t.id)).toEqual(["b2", "c3", "a1"]);
    const undone = setTaskDone(done, "a1", false);
    expect(orderTasks(undone.tasks).map((t) => t.id)).toEqual([
      "a1",
      "b2",
      "c3",
    ]);
  });

  it("reopens and removes tasks of a recipe change", () => {
    const done = setTaskDone(list, "b2", true);
    expect(
      taskForChange(reopenTaskForChange(done, "iron_pickaxe"), "iron_pickaxe")
        ?.done,
    ).toBe(false);
    expect(
      removeTasksForChange(list, "iron_pickaxe").tasks.map((t) => t.id),
    ).toEqual(["a1"]);
    expect(removeTask(list, "a1").tasks.map((t) => t.id)).toEqual(["b2"]);
  });

  it("rejects duplicate IDs and empty titles", () => {
    expect(
      packTasksSchema.safeParse(addManualTask(list, "a1", "Dup")).success,
    ).toBe(false);
    expect(
      packTasksSchema.safeParse(addManualTask(list, "z9", "   ")).success,
    ).toBe(false);
  });
});
