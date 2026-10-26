import { z } from "zod";
import { projectPhaseSchema, type ProjectPhase } from "./custom-mod";
import {
  ENTRY_TYPES,
  type EntryStatus,
  type EntrySummary,
  type EntryType,
} from "./entry";
import { entryIdSchema, isEntryId } from "./entry-id";
import { taskIdSchema, taskTitleSchema } from "./pack-tasks";

/**
 * Custom mod tasks (spec 05, ADR 0010 refined by ADR 0022). Open generated
 * tasks are computed from the entries and the mod's current phase; only
 * per-key state (in progress, done records) and manual tasks are stored in
 * `data/custom-mods/<modid>/tasks.json`.
 */

export const TASK_COLUMNS = ["to_do", "in_progress", "done"] as const;
export const taskColumnSchema = z.enum(TASK_COLUMNS);
export type TaskColumn = z.infer<typeof taskColumnSchema>;

type Rule = { phase: ProjectPhase; from: EntryStatus; to: EntryStatus };

/** One rule per phase; completing moves the entry from `from` to `to`. */
export const GENERATED_RULES = {
  plan_out: { phase: "planning", from: "backlog", to: "planned" },
  implement: { phase: "implementation", from: "planned", to: "implemented" },
  // Completing a polish task changes no status.
  polish: { phase: "optimization", from: "implemented", to: "implemented" },
} as const satisfies Record<string, Rule>;

export type GeneratedRule = keyof typeof GENERATED_RULES;
export const GENERATED_RULE_IDS = Object.keys(
  GENERATED_RULES,
) as GeneratedRule[];

const isRule = (value: string): value is GeneratedRule =>
  Object.hasOwn(GENERATED_RULES, value);

export const ruleForPhase = (phase: ProjectPhase): GeneratedRule =>
  GENERATED_RULE_IDS.find((r) => GENERATED_RULES[r].phase === phase)!;

/** Stable key of a generated task: `<rule>:<entry id>`. */
export const taskKey = (rule: GeneratedRule, entryId: string) =>
  `${rule}:${entryId}`;

export function parseTaskKey(
  key: string,
): { rule: GeneratedRule; entryId: string } | null {
  const index = key.indexOf(":");
  if (index < 0) return null;
  const rule = key.slice(0, index);
  const entryId = key.slice(index + 1);
  return isRule(rule) && isEntryId(entryId) ? { rule, entryId } : null;
}

export const taskKeySchema = z
  .string()
  .refine((key) => parseTaskKey(key) !== null, "Invalid task key");

/**
 * Stored state of a generated task. To do is the default and not stored.
 * Done records keep the entry's name and type at completion, so the task
 * still shows after the entry changes or is deleted.
 */
export const generatedStateSchema = z.discriminatedUnion("column", [
  z.strictObject({ column: z.literal("in_progress") }),
  z.strictObject({
    column: z.literal("done"),
    entryName: z.string().min(1).max(200),
    entryType: z.enum(ENTRY_TYPES),
  }),
]);
export type GeneratedState = z.infer<typeof generatedStateSchema>;

export const manualTaskSchema = z.strictObject({
  id: taskIdSchema,
  title: taskTitleSchema,
  entryId: entryIdSchema.nullable(),
  /** `null`: shows under every phase filter. */
  phase: projectPhaseSchema.nullable(),
  column: taskColumnSchema,
});
export type ManualTask = z.infer<typeof manualTaskSchema>;

export const designerTasksSchema = z
  .strictObject({
    manual: z.array(manualTaskSchema).max(1000).default([]),
    generated: z.record(taskKeySchema, generatedStateSchema).default({}),
  })
  .refine((v) => new Set(v.manual.map((t) => t.id)).size === v.manual.length, {
    message: "Task IDs must be unique",
    path: ["manual"],
  });
export type DesignerTasks = z.infer<typeof designerTasksSchema>;

export const EMPTY_DESIGNER_TASKS: DesignerTasks = {
  manual: [],
  generated: {},
};

/** What the rules need to know about an entry. */
export type TaskEntry = EntrySummary;

export type GeneratedTask = {
  kind: "generated";
  key: string;
  rule: GeneratedRule;
  entryId: string;
  /** Current name and type, or those at completion for done tasks. */
  entryName: string;
  entryType: EntryType;
  phase: ProjectPhase;
  column: TaskColumn;
  /** The entry as it is now; `null` if it was deleted. */
  entry: TaskEntry | null;
};

export type ManualBoardTask = {
  kind: "manual";
  task: ManualTask;
  phase: ProjectPhase | null;
  column: TaskColumn;
  entry: TaskEntry | null;
};

export type BoardTask = GeneratedTask | ManualBoardTask;

const isDone = (state: DesignerTasks, key: string) =>
  state.generated[key]?.column === "done";

/** Whether a generated task is open (To do or In progress) right now. */
function isOpen(
  state: DesignerTasks,
  key: string,
  entry: TaskEntry | undefined | null,
  phase: ProjectPhase,
): boolean {
  const parsed = parseTaskKey(key);
  if (!parsed || !entry || entry.id !== parsed.entryId) return false;
  const rule = GENERATED_RULES[parsed.rule];
  return (
    rule.phase === phase && entry.status === rule.from && !isDone(state, key)
  );
}

/**
 * All tasks of the board: open generated tasks of the current phase (in
 * entry order), done generated tasks, then manual tasks (stored order).
 */
export function boardTasks(
  entries: readonly TaskEntry[],
  phase: ProjectPhase,
  state: DesignerTasks,
): BoardTask[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const rule = ruleForPhase(phase);
  const visible: BoardTask[] = [];
  for (const entry of entries) {
    const key = taskKey(rule, entry.id);
    if (!isOpen(state, key, entry, phase)) continue;
    visible.push({
      kind: "generated",
      key,
      rule,
      entryId: entry.id,
      entryName: entry.name,
      entryType: entry.type,
      phase,
      column:
        state.generated[key]?.column === "in_progress"
          ? "in_progress"
          : "to_do",
      entry,
    });
  }
  for (const [key, record] of Object.entries(state.generated)) {
    const parsed = parseTaskKey(key);
    if (!parsed || record.column !== "done") continue;
    visible.push({
      kind: "generated",
      key,
      rule: parsed.rule,
      entryId: parsed.entryId,
      entryName: record.entryName,
      entryType: record.entryType,
      phase: GENERATED_RULES[parsed.rule].phase,
      column: "done",
      entry: byId.get(parsed.entryId) ?? null,
    });
  }
  for (const task of state.manual) {
    visible.push({
      kind: "manual",
      task,
      phase: task.phase,
      column: task.column,
      entry: task.entryId ? (byId.get(task.entryId) ?? null) : null,
    });
  }
  return visible;
}

export type PhaseFilter = ProjectPhase | "all";

/** Tasks without a phase (manual tasks) show under every filter. */
export const matchesPhase = (boardTask: BoardTask, filter: PhaseFilter) =>
  filter === "all" || boardTask.phase === null || boardTask.phase === filter;

/** Drops in-progress state of generated tasks that are no longer open. */
export function pruneGenerated(
  state: DesignerTasks,
  entries: readonly TaskEntry[],
  phase: ProjectPhase,
): DesignerTasks {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const generated: DesignerTasks["generated"] = {};
  for (const [key, record] of Object.entries(state.generated)) {
    const entryId = parseTaskKey(key)?.entryId;
    if (
      record.column === "done" ||
      isOpen(state, key, entryId ? byId.get(entryId) : null, phase)
    ) {
      generated[key] = record;
    }
  }
  return { ...state, generated };
}

export type GeneratedMove = {
  state: DesignerTasks;
  /** The entry's new status, or `null` if it stays. */
  status: EntryStatus | null;
};

/**
 * Moves a generated task. Completing advances the entry's status (except
 * polish); moving a done task out of Done removes its record and reverts
 * the status. Returns `null` if the move isn't possible: the task is of
 * another phase, its entry is gone, or the status no longer fits.
 */
export function moveGenerated(
  state: DesignerTasks,
  key: string,
  column: TaskColumn,
  entry: TaskEntry | null,
  phase: ProjectPhase,
): GeneratedMove | null {
  const parsed = parseTaskKey(key);
  if (!parsed || !entry || entry.id !== parsed.entryId) return null;
  const rule = GENERATED_RULES[parsed.rule];
  if (rule.phase !== phase) return null;
  const { [key]: record, ...others } = state.generated;
  const withColumn = (c: TaskColumn): DesignerTasks["generated"] => {
    if (c === "to_do") return others;
    if (c === "in_progress") return { ...others, [key]: { column: c } };
    return {
      ...others,
      [key]: { column: c, entryName: entry.name, entryType: entry.type },
    };
  };

  if (record?.column === "done") {
    if (column === "done") return { state, status: null };
    // The task must be open again afterwards.
    const reverted = entry.status === rule.to ? rule.from : entry.status;
    if (reverted !== rule.from) return null;
    return {
      state: { ...state, generated: withColumn(column) },
      status: reverted === entry.status ? null : reverted,
    };
  }
  if (entry.status !== rule.from) return null;
  return {
    state: { ...state, generated: withColumn(column) },
    status: column === "done" && rule.to !== rule.from ? rule.to : null,
  };
}

export const addManualTask = (
  state: DesignerTasks,
  task: ManualTask,
): DesignerTasks => ({ ...state, manual: [...state.manual, task] });

export const moveManualTask = (
  state: DesignerTasks,
  id: string,
  column: TaskColumn,
): DesignerTasks => ({
  ...state,
  manual: state.manual.map((t) => (t.id === id ? { ...t, column } : t)),
});

export const removeManualTask = (
  state: DesignerTasks,
  id: string,
): DesignerTasks => ({
  ...state,
  manual: state.manual.filter((t) => t.id !== id),
});
