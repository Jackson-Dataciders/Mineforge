import { z } from "zod";
import { changeIdSchema } from "./recipe-change";

/**
 * `data/modpacks/<pack-id>/tasks.json` (ADR 0020). Modpacks have manual
 * tasks and KubeJS tasks; KubeJS tasks are created with their recipe change
 * and get their title from i18n plus the change's item name.
 */
export const TASK_ID_PATTERN = /^[a-z0-9]{1,32}$/;
export const taskIdSchema = z.string().regex(TASK_ID_PATTERN);

export const taskTitleSchema = z.string().trim().min(1).max(200);

export const packTaskSchema = z.discriminatedUnion("type", [
  z.strictObject({
    id: taskIdSchema,
    type: z.literal("manual"),
    title: taskTitleSchema,
    done: z.boolean(),
  }),
  z.strictObject({
    id: taskIdSchema,
    type: z.literal("kubejs"),
    recipeChangeId: changeIdSchema,
    done: z.boolean(),
  }),
]);
export type PackTask = z.infer<typeof packTaskSchema>;

export const packTasksSchema = z
  .strictObject({ tasks: z.array(packTaskSchema) })
  .refine((v) => new Set(v.tasks.map((t) => t.id)).size === v.tasks.length, {
    message: "Task IDs must be unique",
    path: ["tasks"],
  });
export type PackTasks = z.infer<typeof packTasksSchema>;

export const EMPTY_PACK_TASKS: PackTasks = { tasks: [] };

export function addManualTask(
  list: PackTasks,
  id: string,
  title: string,
): PackTasks {
  return {
    tasks: [
      ...list.tasks,
      { id, type: "manual", title: title.trim(), done: false },
    ],
  };
}

/** Adds the KubeJS task of a new recipe change (no-op if it already has one). */
export function addKubeJsTask(
  list: PackTasks,
  id: string,
  recipeChangeId: string,
): PackTasks {
  if (taskForChange(list, recipeChangeId)) return list;
  return {
    tasks: [...list.tasks, { id, type: "kubejs", recipeChangeId, done: false }],
  };
}

export const taskForChange = (list: PackTasks, recipeChangeId: string) =>
  list.tasks.find(
    (t) => t.type === "kubejs" && t.recipeChangeId === recipeChangeId,
  );

export function setTaskDone(
  list: PackTasks,
  taskId: string,
  done: boolean,
): PackTasks {
  return {
    tasks: list.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)),
  };
}

/** An edited change needs its script written again: uncheck its task. */
export function reopenTaskForChange(
  list: PackTasks,
  recipeChangeId: string,
): PackTasks {
  return {
    tasks: list.tasks.map((t) =>
      t.type === "kubejs" && t.recipeChangeId === recipeChangeId
        ? { ...t, done: false }
        : t,
    ),
  };
}

export const removeTask = (list: PackTasks, taskId: string): PackTasks => ({
  tasks: list.tasks.filter((t) => t.id !== taskId),
});

export const removeTasksForChange = (
  list: PackTasks,
  recipeChangeId: string,
): PackTasks => ({
  tasks: list.tasks.filter(
    (t) => !(t.type === "kubejs" && t.recipeChangeId === recipeChangeId),
  ),
});

/** Display order: open tasks, then done tasks; each group in stored order. */
export const orderTasks = (tasks: readonly PackTask[]): PackTask[] => [
  ...tasks.filter((t) => !t.done),
  ...tasks.filter((t) => t.done),
];
