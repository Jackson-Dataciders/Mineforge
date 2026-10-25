import { z } from "zod";
import { resourceIdSchema } from "./library";
import { editableRecipeSchema, recipeResult } from "./recipe";

/**
 * `data/modpacks/<pack-id>/recipe-changes/<change-id>.json` (ADR 0020).
 * The change ID is also the KubeJS slug: recipe ID `<pack-id>:<change-id>`.
 */
export const CHANGE_ID_PATTERN = /^[a-z0-9_-][a-z0-9_.-]{0,99}$/;
const RESERVED_CHANGE_IDS = new Set(["new"]);
export const isChangeId = (value: string) =>
  CHANGE_ID_PATTERN.test(value) && !RESERVED_CHANGE_IDS.has(value);
export const changeIdSchema = z
  .string()
  .refine(isChangeId, "Invalid change ID");

export const RECIPE_CHANGE_ACTIONS = ["add", "replace", "remove"] as const;
export type RecipeChangeAction = (typeof RECIPE_CHANGE_ACTIONS)[number];

const base = {
  id: changeIdSchema,
  /** The output item the change is about. */
  item: resourceIdSchema,
  /** English item name at save time (always en_us, never translated). */
  itemName: z.string().trim().min(1).max(200),
};

export const recipeChangeSchema = z
  .discriminatedUnion("action", [
    z.strictObject({
      ...base,
      action: z.literal("add"),
      recipe: editableRecipeSchema,
    }),
    z.strictObject({
      ...base,
      action: z.literal("replace"),
      replacedRecipeId: resourceIdSchema,
      recipe: editableRecipeSchema,
    }),
    z.strictObject({
      ...base,
      action: z.literal("remove"),
      removedRecipeId: resourceIdSchema,
    }),
  ])
  .superRefine((change, ctx) => {
    if (change.action === "remove") return;
    const result = recipeResult(change.recipe);
    if (result && result.id !== change.item) {
      ctx.addIssue({
        code: "custom",
        message: "The result must be the change's item",
        path: ["recipe", "result", "id"],
      });
    }
  });
export type RecipeChange = z.infer<typeof recipeChangeSchema>;

/** The recipe ID a change removes, if any. */
export function removedRecipeId(change: RecipeChange): string | null {
  if (change.action === "replace") return change.replacedRecipeId;
  if (change.action === "remove") return change.removedRecipeId;
  return null;
}

/**
 * Change ID for an item: its path with `/` → `_`, then `_2`, `_3`, … until
 * unused. Never a reserved ID.
 */
export function suggestChangeId(
  itemId: string,
  existing: Iterable<string>,
): string {
  const taken = new Set(existing);
  const path = itemId.slice(itemId.indexOf(":") + 1);
  let stem = path
    .replace(/\//g, "_")
    .replace(/[^a-z0-9_.-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 90);
  if (!stem) stem = "change";
  const free = (id: string) => isChangeId(id) && !taken.has(id);
  if (free(stem)) return stem;
  for (let n = 2; ; n++) {
    const candidate = `${stem}_${n}`;
    if (free(candidate)) return candidate;
  }
}

/** What the editor sends when saving: the action and its fields, no ID or item name. */
export const recipeChangeEditSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("add"), recipe: editableRecipeSchema }),
  z.strictObject({
    action: z.literal("replace"),
    replacedRecipeId: resourceIdSchema,
    recipe: editableRecipeSchema,
  }),
  z.strictObject({
    action: z.literal("remove"),
    removedRecipeId: resourceIdSchema,
  }),
]);
export type RecipeChangeEdit = z.infer<typeof recipeChangeEditSchema>;
