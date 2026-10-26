import { describe, expect, it } from "vitest";
import { defaultEntry } from "@/domain/entry";
import { encodeJson } from "@/lib/stable-json";
import { getCustomMod, setCustomModPhase } from "./custom-mods";
import {
  createManualTask,
  deleteManualTask,
  moveGeneratedTask,
  moveManualTask,
  readDesignerTasks,
} from "./designer-tasks";
import { createEntry, deleteEntry, getEntry, updateEntry } from "./entries";
import { MemoryBackend } from "./memory-backend";
import { isConflictError, isNotFoundError, isValidationError } from "./types";

const MOD = "data/custom-mods/mine/mod.json";
const TASKS = "data/custom-mods/mine/tasks.json";
const KEY = "plan_out:mine:gear";

function seeded() {
  return new MemoryBackend({
    [MOD]: encodeJson({
      modId: "mine",
      name: "Mine",
      phase: "planning",
      dependencies: [],
      recipeTypes: [],
    }),
    "data/custom-mods/mine/entries/gear.json": encodeJson(
      defaultEntry("item", "mine:gear", "Gear"),
    ),
    "data/custom-mods/mine/entries/press.json": encodeJson({
      ...defaultEntry("block", "mine:press", "Press"),
      status: "planned",
    }),
  });
}

const reason = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (e: unknown) =>
      isValidationError(e)
        ? e.code
        : isConflictError(e)
          ? "conflict"
          : isNotFoundError(e)
            ? "notFound"
            : String(e),
  );

const status = async (storage: MemoryBackend, path: string) =>
  (await getEntry(storage, "mine", path))!.data.status;

describe("designer tasks", () => {
  it("reads an empty state when tasks.json is missing", async () => {
    expect(await readDesignerTasks(seeded(), "mine")).toEqual({
      data: { manual: [], generated: {} },
      sha: null,
    });
  });

  it("completes a generated task and advances the entry in one commit", async () => {
    const storage = seeded();
    const result = await moveGeneratedTask(storage, "mine", KEY, "done", null);
    expect(result.entry).toEqual({ id: "mine:gear", status: "planned" });
    expect(storage.log).toEqual([`data: complete task ${KEY}`]);
    expect(await status(storage, "gear")).toBe("planned");
    const stored = await readDesignerTasks(storage, "mine");
    expect(stored).toEqual(result.tasks);
    expect(stored.data.generated[KEY]).toEqual({
      column: "done",
      entryName: "Gear",
      entryType: "item",
    });
  });

  it("reopens a done task and reverts the entry in one commit", async () => {
    const storage = seeded();
    const done = await moveGeneratedTask(storage, "mine", KEY, "done", null);
    const reopened = await moveGeneratedTask(
      storage,
      "mine",
      KEY,
      "in_progress",
      done.tasks.sha,
    );
    expect(reopened.entry).toEqual({ id: "mine:gear", status: "backlog" });
    expect(storage.log.at(-1)).toBe(`data: reopen task ${KEY}`);
    expect(storage.log).toHaveLength(2);
    expect(await status(storage, "gear")).toBe("backlog");
    expect(reopened.tasks.data.generated).toEqual({
      [KEY]: { column: "in_progress" },
    });
  });

  it("moves to In progress without touching the entry", async () => {
    const storage = seeded();
    const before = await getEntry(storage, "mine", "gear");
    const result = await moveGeneratedTask(
      storage,
      "mine",
      KEY,
      "in_progress",
      null,
    );
    expect(result.entry).toBeNull();
    expect((await getEntry(storage, "mine", "gear"))!.sha).toBe(before!.sha);
  });

  it("refuses tasks of another phase, foreign keys and stale SHAs", async () => {
    const storage = seeded();
    expect(
      await reason(
        moveGeneratedTask(
          storage,
          "mine",
          "implement:mine:press",
          "done",
          null,
        ),
      ),
    ).toBe("taskNotMovable");
    expect(
      await reason(
        moveGeneratedTask(storage, "mine", "plan_out:other:x", "done", null),
      ),
    ).toBe("notFound");
    await moveGeneratedTask(storage, "mine", KEY, "in_progress", null);
    expect(
      await reason(moveGeneratedTask(storage, "mine", KEY, "done", null)),
    ).toBe("conflict");
    expect(await status(storage, "gear")).toBe("backlog");
  });

  it("refuses to reopen a done task of an earlier phase", async () => {
    const storage = seeded();
    const done = await moveGeneratedTask(storage, "mine", KEY, "done", null);
    const mod = await getCustomMod(storage, "mine");
    await setCustomModPhase(storage, "mine", "implementation", mod!.sha);
    expect(storage.log.at(-1)).toBe(
      "data: set phase of custom mod mine to implementation",
    );
    expect(
      await reason(
        moveGeneratedTask(storage, "mine", KEY, "to_do", done.tasks.sha),
      ),
    ).toBe("taskNotMovable");
    // The new phase's task for the same entry works.
    const next = await moveGeneratedTask(
      storage,
      "mine",
      "implement:mine:gear",
      "done",
      done.tasks.sha,
    );
    expect(next.entry?.status).toBe("implemented");
    expect(Object.keys(next.tasks.data.generated).sort()).toEqual([
      "implement:mine:gear",
      KEY,
    ]);
  });

  it("conflicts when the phase changed since the board was loaded", async () => {
    const storage = seeded();
    const mod = await getCustomMod(storage, "mine");
    // A concurrent write to mod.json between read and commit.
    const original = storage.commit.bind(storage);
    storage.commit = async (input) => {
      storage.commit = original;
      await setCustomModPhase(storage, "mine", "optimization", mod!.sha);
      return original(input);
    };
    expect(
      await reason(moveGeneratedTask(storage, "mine", KEY, "done", null)),
    ).toBe("conflict");
  });

  it("prunes in-progress state in the same commit as a phase change", async () => {
    const storage = seeded();
    await moveGeneratedTask(storage, "mine", KEY, "in_progress", null);
    const mod = await getCustomMod(storage, "mine");
    await setCustomModPhase(storage, "mine", "optimization", mod!.sha);
    expect(storage.log).toHaveLength(2);
    expect((await readDesignerTasks(storage, "mine")).data.generated).toEqual(
      {},
    );
    // Back in planning, the task starts in To do again.
    const again = await getCustomMod(storage, "mine");
    await setCustomModPhase(storage, "mine", "planning", again!.sha);
    expect((await readDesignerTasks(storage, "mine")).data.generated).toEqual(
      {},
    );
  });

  it("prunes in-progress state when an entry's status changes", async () => {
    const storage = seeded();
    await moveGeneratedTask(storage, "mine", KEY, "in_progress", null);
    const gear = (await getEntry(storage, "mine", "gear"))!;
    await updateEntry(
      storage,
      "mine",
      "gear",
      { ...gear.data, status: "planned" },
      gear.sha,
      undefined,
    );
    expect(storage.log).toHaveLength(2);
    expect((await readDesignerTasks(storage, "mine")).data.generated).toEqual(
      {},
    );
  });

  it("keeps done records but prunes in-progress state on entry delete", async () => {
    const storage = seeded();
    const done = await moveGeneratedTask(storage, "mine", KEY, "done", null);
    await createEntry(
      storage,
      "mine",
      defaultEntry("mechanic", "mine:heat", "Heat"),
      undefined,
    );
    const started = await moveGeneratedTask(
      storage,
      "mine",
      "plan_out:mine:heat",
      "in_progress",
      done.tasks.sha,
    );
    expect(Object.keys(started.tasks.data.generated)).toHaveLength(2);
    for (const path of ["gear", "heat"]) {
      const entry = (await getEntry(storage, "mine", path))!;
      await deleteEntry(storage, "mine", path, entry.sha);
    }
    expect((await readDesignerTasks(storage, "mine")).data.generated).toEqual({
      [KEY]: { column: "done", entryName: "Gear", entryType: "item" },
    });
  });
});

describe("pruning races", () => {
  /** Runs `during` right before the next commit, as a concurrent write. */
  function interleave(storage: MemoryBackend, during: () => Promise<unknown>) {
    const original = storage.commit.bind(storage);
    storage.commit = async (input) => {
      storage.commit = original;
      await during();
      return original(input);
    };
  }

  it("conflicts when a task moves during a phase change", async () => {
    const storage = seeded();
    const mod = await getCustomMod(storage, "mine");
    interleave(storage, () =>
      moveGeneratedTask(storage, "mine", KEY, "in_progress", null),
    );
    expect(
      await reason(
        setCustomModPhase(storage, "mine", "optimization", mod!.sha),
      ),
    ).toBe("conflict");
  });

  it("conflicts when the phase changes during an entry save", async () => {
    const storage = seeded();
    const gear = (await getEntry(storage, "mine", "gear"))!;
    const mod = await getCustomMod(storage, "mine");
    interleave(storage, () =>
      setCustomModPhase(storage, "mine", "optimization", mod!.sha),
    );
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "gear",
          { ...gear.data, name: "Big Gear" },
          gear.sha,
          undefined,
        ),
      ),
    ).toBe("conflict");
  });
});

describe("manual designer tasks", () => {
  it("creates, moves and deletes", async () => {
    const storage = seeded();
    const created = await createManualTask(
      storage,
      "mine",
      {
        title: "  Wiki page  ",
        entryId: "mine:press",
        phase: "implementation",
      },
      null,
    );
    const [task] = created.data.manual;
    expect(task).toMatchObject({
      title: "Wiki page",
      entryId: "mine:press",
      phase: "implementation",
      column: "to_do",
    });
    const moved = await moveManualTask(
      storage,
      "mine",
      task!.id,
      "done",
      created.sha,
    );
    expect(moved.data.manual[0]?.column).toBe("done");
    // Completing a manual task changes no entry.
    expect(await status(storage, "press")).toBe("planned");
    const deleted = await deleteManualTask(
      storage,
      "mine",
      task!.id,
      moved.sha,
    );
    expect(deleted.data.manual).toEqual([]);
    expect(storage.log).toEqual([
      "data: add task to custom mod mine",
      `data: move task ${task!.id} in custom mod mine`,
      `data: delete task ${task!.id} in custom mod mine`,
    ]);
    expect(
      await reason(deleteManualTask(storage, "mine", task!.id, deleted.sha)),
    ).toBe("notFound");
  });

  it("rejects unknown linked entries and unknown mods", async () => {
    const storage = seeded();
    expect(
      await reason(
        createManualTask(
          storage,
          "mine",
          { title: "X", entryId: "mine:nope", phase: null },
          null,
        ),
      ),
    ).toBe("unknownEntry");
    expect(
      await reason(
        createManualTask(
          storage,
          "nope",
          { title: "X", entryId: null, phase: null },
          null,
        ),
      ),
    ).toBe("notFound");
  });

  it("doesn't write a move that changes nothing", async () => {
    const storage = seeded();
    const created = await createManualTask(
      storage,
      "mine",
      { title: "X", entryId: null, phase: null },
      null,
    );
    const id = created.data.manual[0]!.id;
    await moveManualTask(storage, "mine", id, "to_do", created.sha);
    expect(storage.log).toHaveLength(1);
    expect((await storage.readFile(TASKS))!.sha).toBe(created.sha);
  });
});
