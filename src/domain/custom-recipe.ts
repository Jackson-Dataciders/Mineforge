import { z } from "zod";
import { entryIdSchema } from "./entry-id";
import { resourceIdSchema } from "./library";
import { ingredientSchema, MAX_RESULT_COUNT, type Ingredient } from "./recipe";

/**
 * Custom machine recipe types, defined per custom mod in `mod.json`, and
 * recipes of those types on entries (spec 04, ADR 0021).
 */

export const RECIPE_TYPE_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
export const recipeTypeIdSchema = z.string().regex(RECIPE_TYPE_ID_PATTERN);

export const INPUT_SLOT_TYPES = ["item", "fluid", "energy"] as const;
export const OUTPUT_SLOT_TYPES = ["item", "fluid"] as const;
export type InputSlotType = (typeof INPUT_SLOT_TYPES)[number];
export type OutputSlotType = (typeof OUTPUT_SLOT_TYPES)[number];

export const MAX_SLOTS = 9;

export const customRecipeTypeSchema = z.strictObject({
  id: recipeTypeIdSchema,
  name: z.string().trim().min(1).max(100),
  /** A block or multiblock entry of the same mod (checked by storage). */
  machine: entryIdSchema,
  inputs: z
    .array(z.strictObject({ type: z.enum(INPUT_SLOT_TYPES) }))
    .min(1)
    .max(MAX_SLOTS),
  outputs: z
    .array(
      z.strictObject({ type: z.enum(OUTPUT_SLOT_TYPES), chance: z.boolean() }),
    )
    .min(1)
    .max(MAX_SLOTS),
  parameters: z.strictObject({
    processingTime: z.boolean(),
    energyCost: z.boolean(),
  }),
});
export type CustomRecipeType = z.infer<typeof customRecipeTypeSchema>;

const amount = (max: number) => z.int().min(1).max(max);
const chance = z.number().min(0).max(1);

export const customInputSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("item"), ingredient: ingredientSchema }),
  z.strictObject({
    type: z.literal("fluid"),
    fluid: resourceIdSchema,
    /** Millibuckets. */
    amount: amount(1_000_000),
  }),
  z.strictObject({
    type: z.literal("energy"),
    /** FE. */
    amount: amount(1_000_000_000),
  }),
]);
export type CustomInput = z.infer<typeof customInputSchema>;

export const customOutputSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("item"),
    item: resourceIdSchema,
    count: z.int().min(1).max(MAX_RESULT_COUNT),
    chance: chance.optional(),
  }),
  z.strictObject({
    type: z.literal("fluid"),
    fluid: resourceIdSchema,
    amount: amount(1_000_000),
    chance: chance.optional(),
  }),
]);
export type CustomOutput = z.infer<typeof customOutputSchema>;

export const customRecipeSchema = z.strictObject({
  type: z.literal("custom"),
  recipeType: recipeTypeIdSchema,
  inputs: z.array(customInputSchema).min(1).max(MAX_SLOTS),
  outputs: z.array(customOutputSchema).min(1).max(MAX_SLOTS),
  /** Ticks. */
  processingTime: z.int().min(1).max(1_000_000).optional(),
  /** FE per recipe. */
  energyCost: z.int().min(1).max(1_000_000_000).optional(),
});
export type CustomRecipe = z.infer<typeof customRecipeSchema>;

export type CustomRecipeProblem =
  "slotCount" | "slotType" | "chance" | "parameters";

/** Whether a recipe matches its type's slots and parameters; `null` if it does. */
export function customRecipeProblem(
  recipe: CustomRecipe,
  type: CustomRecipeType,
): CustomRecipeProblem | null {
  if (
    recipe.inputs.length !== type.inputs.length ||
    recipe.outputs.length !== type.outputs.length
  ) {
    return "slotCount";
  }
  if (recipe.inputs.some((input, i) => input.type !== type.inputs[i]!.type)) {
    return "slotType";
  }
  if (recipe.outputs.some((out, i) => out.type !== type.outputs[i]!.type)) {
    return "slotType";
  }
  if (
    recipe.outputs.some(
      (out, i) => (out.chance !== undefined) !== type.outputs[i]!.chance,
    )
  ) {
    return "chance";
  }
  const { processingTime, energyCost } = type.parameters;
  if (
    (recipe.processingTime !== undefined) !== processingTime ||
    (recipe.energyCost !== undefined) !== energyCost
  ) {
    return "parameters";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Drafts for the generated editor (slots may still be empty)

export type CustomInputDraft =
  | { type: "item"; ingredient: Ingredient | null }
  | { type: "fluid"; fluid: string; amount: number }
  | { type: "energy"; amount: number };

export type CustomOutputDraft =
  | { type: "item"; item: string | null; count: number; chance?: number }
  | { type: "fluid"; fluid: string; amount: number; chance?: number };

export type CustomRecipeDraft = {
  type: "custom";
  recipeType: string;
  inputs: CustomInputDraft[];
  outputs: CustomOutputDraft[];
  processingTime?: number;
  energyCost?: number;
};

/**
 * Empty draft matching a type. The first item output defaults to `resultId`
 * (the entry the recipe belongs to).
 */
export function emptyCustomDraft(
  type: CustomRecipeType,
  resultId: string | null,
): CustomRecipeDraft {
  let resultUsed = false;
  return {
    type: "custom",
    recipeType: type.id,
    inputs: type.inputs.map((slot): CustomInputDraft => {
      if (slot.type === "item") return { type: "item", ingredient: null };
      if (slot.type === "fluid")
        return { type: "fluid", fluid: "", amount: 1000 };
      return { type: "energy", amount: 1000 };
    }),
    outputs: type.outputs.map((slot): CustomOutputDraft => {
      const chanceValue = slot.chance ? { chance: 1 } : {};
      if (slot.type === "fluid") {
        return { type: "fluid", fluid: "", amount: 1000, ...chanceValue };
      }
      const item = resultUsed ? null : resultId;
      resultUsed = true;
      return { type: "item", item, count: 1, ...chanceValue };
    }),
    ...(type.parameters.processingTime ? { processingTime: 200 } : {}),
    ...(type.parameters.energyCost ? { energyCost: 1000 } : {}),
  };
}

/**
 * Draft for editing an existing recipe. With its type, the draft follows the
 * type's current parameters and output chances (a type may have changed
 * since the recipe was saved); slots that no longer match stay as they are
 * and the editor offers to rebuild them.
 */
export function customRecipeToDraft(
  recipe: CustomRecipe,
  type?: CustomRecipeType,
): CustomRecipeDraft {
  const draft: CustomRecipeDraft = structuredClone(recipe);
  if (!type) return draft;
  const { processingTime, energyCost } = type.parameters;
  if (!processingTime) delete draft.processingTime;
  else draft.processingTime ??= 200;
  if (!energyCost) delete draft.energyCost;
  else draft.energyCost ??= 1000;
  draft.outputs = draft.outputs.map((out, i) => {
    const slot = type.outputs[i];
    if (!slot || slot.type !== out.type) return out;
    if (slot.chance) return { ...out, chance: out.chance ?? 1 };
    const withoutChance = { ...out };
    delete withoutChance.chance;
    return withoutChance;
  });
  return draft;
}

/** Draft → recipe, validated against its type. */
export function customDraftToRecipe(
  draft: CustomRecipeDraft,
  type: CustomRecipeType,
):
  | { ok: true; recipe: CustomRecipe }
  | { ok: false; error: "incomplete" | "invalid" | CustomRecipeProblem } {
  if (
    draft.inputs.some((i) => i.type === "item" && !i.ingredient) ||
    draft.outputs.some((o) => o.type === "item" && !o.item)
  ) {
    return { ok: false, error: "incomplete" };
  }
  const parsed = customRecipeSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const problem = customRecipeProblem(parsed.data, type);
  return problem
    ? { ok: false, error: problem }
    : { ok: true, recipe: parsed.data };
}

/** Item IDs a custom recipe uses (ingredients and item outputs). */
export function customRecipeItems(recipe: CustomRecipe): string[] {
  const ids: string[] = [];
  for (const input of recipe.inputs) {
    if (input.type !== "item") continue;
    const values = Array.isArray(input.ingredient)
      ? input.ingredient
      : [input.ingredient];
    for (const v of values) if ("item" in v) ids.push(v.item);
  }
  for (const out of recipe.outputs) if (out.type === "item") ids.push(out.item);
  return ids;
}
