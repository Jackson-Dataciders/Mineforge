import { z } from "zod";
import { resourceIdSchema } from "./library";

/**
 * Recipes as the visual editors edit them (spec 03, ADR 0020). Ingredients
 * keep vanilla's 1.21.1 JSON shape, so parsing existing recipes and writing
 * KubeJS stays a direct mapping.
 */

const itemValueSchema = z.strictObject({ item: resourceIdSchema });
const tagValueSchema = z.strictObject({ tag: resourceIdSchema });
export const ingredientValueSchema = z.union([itemValueSchema, tagValueSchema]);
export type IngredientValue = z.infer<typeof ingredientValueSchema>;

/** One item, one tag, or a list of alternatives (≥ 2). */
export const ingredientSchema = z.union([
  ingredientValueSchema,
  z.array(ingredientValueSchema).min(2),
]);
export type Ingredient = z.infer<typeof ingredientSchema>;

export const MAX_RESULT_COUNT = 99;
export const recipeResultSchema = z.strictObject({
  id: resourceIdSchema,
  count: z.int().min(1).max(MAX_RESULT_COUNT),
});
export type RecipeResult = z.infer<typeof recipeResultSchema>;

export const SHAPED = "minecraft:crafting_shaped";
export const SHAPELESS = "minecraft:crafting_shapeless";
export const STONECUTTING = "minecraft:stonecutting";
export const SMITHING = "minecraft:smithing_transform";
export const COOKING_TYPES = [
  "minecraft:smelting",
  "minecraft:blasting",
  "minecraft:smoking",
  "minecraft:campfire_cooking",
] as const;
export type CookingType = (typeof COOKING_TYPES)[number];
export const JSON_RECIPE = "json";

/** Vanilla 1.21.1 default cooking times in ticks. */
export const DEFAULT_COOKING_TIME: Record<CookingType, number> = {
  "minecraft:smelting": 200,
  "minecraft:blasting": 100,
  "minecraft:smoking": 100,
  "minecraft:campfire_cooking": 600,
};

/** Types with a visual editor, in menu order. */
export const VISUAL_RECIPE_TYPES = [
  SHAPED,
  SHAPELESS,
  ...COOKING_TYPES,
  STONECUTTING,
  SMITHING,
] as const;
export type VisualRecipeType = (typeof VISUAL_RECIPE_TYPES)[number];
export const isVisualRecipeType = (type: string): type is VisualRecipeType =>
  (VISUAL_RECIPE_TYPES as readonly string[]).includes(type);

const shapedSchema = z
  .strictObject({
    type: z.literal(SHAPED),
    /** 3×3 cells in reading order; `null` is an empty cell. */
    pattern: z.array(ingredientSchema.nullable()).length(9),
    result: recipeResultSchema,
  })
  .refine((r) => r.pattern.some((cell) => cell !== null), {
    message: "A shaped recipe needs at least one ingredient",
    path: ["pattern"],
  });

const shapelessSchema = z.strictObject({
  type: z.literal(SHAPELESS),
  ingredients: z.array(ingredientSchema).min(1).max(9),
  result: recipeResultSchema,
});

const cookingSchema = <T extends CookingType>(type: T) =>
  z.strictObject({
    type: z.literal(type),
    ingredient: ingredientSchema,
    result: recipeResultSchema,
    experience: z.number().min(0).max(10_000),
    cookingTime: z.int().min(1).max(1_000_000),
  });

const stonecuttingSchema = z.strictObject({
  type: z.literal(STONECUTTING),
  ingredient: ingredientSchema,
  result: recipeResultSchema,
});

const smithingSchema = z.strictObject({
  type: z.literal(SMITHING),
  template: ingredientSchema,
  base: ingredientSchema,
  addition: ingredientSchema,
  result: recipeResultSchema,
});

/** Raw recipe JSON for any type without a visual editor. */
export const rawRecipeSchema = z
  .record(z.string(), z.unknown())
  .refine((d) => typeof d.type === "string" && d.type.length > 0, {
    message: "The recipe needs a string type",
    path: ["type"],
  });

const jsonSchema = z.strictObject({
  type: z.literal(JSON_RECIPE),
  data: rawRecipeSchema,
});

export const editableRecipeSchema = z.discriminatedUnion("type", [
  shapedSchema,
  shapelessSchema,
  cookingSchema("minecraft:smelting"),
  cookingSchema("minecraft:blasting"),
  cookingSchema("minecraft:smoking"),
  cookingSchema("minecraft:campfire_cooking"),
  stonecuttingSchema,
  smithingSchema,
  jsonSchema,
]);
export type EditableRecipe = z.infer<typeof editableRecipeSchema>;
export type VisualRecipe = Exclude<EditableRecipe, { type: "json" }>;

/** The result of a visual recipe, or `null` for JSON recipes. */
export function recipeResult(recipe: EditableRecipe): RecipeResult | null {
  return recipe.type === JSON_RECIPE ? null : recipe.result;
}

// ---------------------------------------------------------------------------
// Parsing existing recipe JSON (vanilla and library data) into the visual model

const withNamespace = (id: string) =>
  id.includes(":") ? id : `minecraft:${id}`;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function parseIngredientValue(raw: unknown): IngredientValue | null {
  if (!isRecord(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.length !== 1) return null;
  if (typeof raw.item === "string") return { item: withNamespace(raw.item) };
  if (typeof raw.tag === "string") return { tag: withNamespace(raw.tag) };
  return null;
}

/** Vanilla ingredient JSON → `Ingredient`; `null` for anything else (custom ingredients). */
export function parseIngredient(raw: unknown): Ingredient | null {
  if (Array.isArray(raw)) {
    const values = raw.map(parseIngredientValue);
    if (values.length === 0 || values.some((v) => v === null)) return null;
    return values.length === 1 ? values[0]! : (values as IngredientValue[]);
  }
  return parseIngredientValue(raw);
}

function parseResult(raw: unknown): RecipeResult | null {
  if (typeof raw === "string") return { id: withNamespace(raw), count: 1 };
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  if (Object.keys(raw).some((k) => k !== "id" && k !== "count")) return null;
  const count = raw.count === undefined ? 1 : raw.count;
  if (typeof count !== "number") return null;
  return { id: withNamespace(raw.id), count };
}

function parseShapedPattern(
  pattern: unknown,
  key: unknown,
): (Ingredient | null)[] | null {
  if (!Array.isArray(pattern) || !isRecord(key)) return null;
  if (pattern.length < 1 || pattern.length > 3) return null;
  const cells: (Ingredient | null)[] = Array(9).fill(null);
  for (const [row, line] of pattern.entries()) {
    if (typeof line !== "string" || line.length > 3) return null;
    for (const [col, char] of [...line].entries()) {
      if (char === " ") continue;
      const ingredient = parseIngredient(key[char]);
      if (!ingredient) return null;
      cells[row * 3 + col] = ingredient;
    }
  }
  return cells;
}

/**
 * Raw recipe JSON → the visual model, or `null` if it has no visual editor
 * or uses something the editor can't show (custom ingredients, result
 * components). Category, group and notification settings are not kept.
 */
export function parseVisualRecipe(
  raw: Record<string, unknown>,
): VisualRecipe | null {
  if (typeof raw.type !== "string") return null;
  const type = withNamespace(raw.type);
  let candidate: unknown = null;
  if (type === SHAPED) {
    candidate = {
      type,
      pattern: parseShapedPattern(raw.pattern, raw.key),
      result: parseResult(raw.result),
    };
  } else if (type === SHAPELESS) {
    const ingredients = Array.isArray(raw.ingredients)
      ? raw.ingredients.map(parseIngredient)
      : null;
    candidate = {
      type,
      ingredients,
      result: parseResult(raw.result),
    };
  } else if ((COOKING_TYPES as readonly string[]).includes(type)) {
    candidate = {
      type,
      ingredient: parseIngredient(raw.ingredient),
      result: parseResult(raw.result),
      experience: raw.experience ?? 0,
      cookingTime: raw.cookingtime ?? DEFAULT_COOKING_TIME[type as CookingType],
    };
  } else if (type === STONECUTTING) {
    candidate = {
      type,
      ingredient: parseIngredient(raw.ingredient),
      result: parseResult(raw.result),
    };
  } else if (type === SMITHING) {
    candidate = {
      type,
      template: parseIngredient(raw.template),
      base: parseIngredient(raw.base),
      addition: parseIngredient(raw.addition),
      result: parseResult(raw.result),
    };
  }
  const parsed = editableRecipeSchema.safeParse(candidate);
  return parsed.success && parsed.data.type !== JSON_RECIPE
    ? parsed.data
    : null;
}

// ---------------------------------------------------------------------------
// Output detection for "recipes that produce this item"

const OUTPUT_KEYS = ["result", "results", "output", "outputs"] as const;

function collectIds(value: unknown, out: Set<string>, depth: number) {
  if (depth > 6) return;
  if (typeof value === "string") {
    if (resourceIdSchema.safeParse(withNamespace(value)).success) {
      out.add(withNamespace(value));
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectIds(v, out, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const key of ["id", "item"] as const) {
    if (key in value) collectIds(value[key], out, depth + 1);
  }
}

/**
 * Item IDs a raw recipe produces, read from `result`, `results`, `output`
 * and `outputs` (strings or `{ id }` / `{ item }` objects, recursively).
 * Covers vanilla and the common modded shapes; fluids are ignored.
 */
export function recipeOutputIds(raw: Record<string, unknown>): string[] {
  const out = new Set<string>();
  for (const key of OUTPUT_KEYS) collectIds(raw[key], out, 0);
  return [...out];
}

// ---------------------------------------------------------------------------
// Drafts: what an editor holds while slots may still be empty

export type RecipeDraft =
  | { type: typeof SHAPED; cells: (Ingredient | null)[]; count: number }
  | { type: typeof SHAPELESS; cells: (Ingredient | null)[]; count: number }
  | {
      type: CookingType;
      ingredient: Ingredient | null;
      count: number;
      experience: number;
      cookingTime: number;
    }
  | { type: typeof STONECUTTING; ingredient: Ingredient | null; count: number }
  | {
      type: typeof SMITHING;
      template: Ingredient | null;
      base: Ingredient | null;
      addition: Ingredient | null;
      count: number;
    }
  | { type: typeof JSON_RECIPE; text: string };

const emptyCells = () => Array<Ingredient | null>(9).fill(null);

/** An empty draft of a type (JSON drafts start from `{ "type": "" }`). */
export function emptyDraft(type: VisualRecipeType | "json"): RecipeDraft {
  switch (type) {
    case SHAPED:
    case SHAPELESS:
      return { type, cells: emptyCells(), count: 1 };
    case STONECUTTING:
      return { type, ingredient: null, count: 1 };
    case SMITHING:
      return { type, template: null, base: null, addition: null, count: 1 };
    case JSON_RECIPE:
      return { type, text: `{\n  "type": ""\n}\n` };
    default:
      return {
        type,
        ingredient: null,
        count: 1,
        experience: 0,
        cookingTime: DEFAULT_COOKING_TIME[type],
      };
  }
}

/** Draft for editing an existing recipe. */
export function recipeToDraft(recipe: EditableRecipe): RecipeDraft {
  switch (recipe.type) {
    case SHAPED:
      return {
        type: SHAPED,
        cells: [...recipe.pattern],
        count: recipe.result.count,
      };
    case SHAPELESS: {
      const cells = emptyCells();
      recipe.ingredients.forEach((ing, i) => (cells[i] = ing));
      return { type: SHAPELESS, cells, count: recipe.result.count };
    }
    case STONECUTTING:
      return {
        type: STONECUTTING,
        ingredient: recipe.ingredient,
        count: recipe.result.count,
      };
    case SMITHING:
      return {
        type: SMITHING,
        template: recipe.template,
        base: recipe.base,
        addition: recipe.addition,
        count: recipe.result.count,
      };
    case JSON_RECIPE:
      return {
        type: JSON_RECIPE,
        text: `${JSON.stringify(recipe.data, null, 2)}\n`,
      };
    default:
      return {
        type: recipe.type,
        ingredient: recipe.ingredient,
        count: recipe.result.count,
        experience: recipe.experience,
        cookingTime: recipe.cookingTime,
      };
  }
}

/** Draft for a raw recipe: visual if possible, otherwise JSON. */
export function rawRecipeToDraft(raw: Record<string, unknown>): RecipeDraft {
  const visual = parseVisualRecipe(raw);
  return visual
    ? recipeToDraft(visual)
    : { type: JSON_RECIPE, text: `${JSON.stringify(raw, null, 2)}\n` };
}

export type DraftError = "incomplete" | "invalidJson" | "invalid";

/** Draft → validated recipe with the given result item, or why it can't be saved. */
export function draftToRecipe(
  draft: RecipeDraft,
  resultId: string,
): { ok: true; recipe: EditableRecipe } | { ok: false; error: DraftError } {
  let candidate: unknown;
  const result = { id: resultId, count: "count" in draft ? draft.count : 1 };
  switch (draft.type) {
    case SHAPED:
      if (draft.cells.every((c) => c === null)) {
        return { ok: false, error: "incomplete" };
      }
      candidate = { type: SHAPED, pattern: draft.cells, result };
      break;
    case SHAPELESS: {
      const ingredients = draft.cells.filter((c) => c !== null);
      if (ingredients.length === 0) return { ok: false, error: "incomplete" };
      candidate = { type: SHAPELESS, ingredients, result };
      break;
    }
    case STONECUTTING:
      if (!draft.ingredient) return { ok: false, error: "incomplete" };
      candidate = { type: STONECUTTING, ingredient: draft.ingredient, result };
      break;
    case SMITHING:
      if (!draft.template || !draft.base || !draft.addition) {
        return { ok: false, error: "incomplete" };
      }
      candidate = {
        type: SMITHING,
        template: draft.template,
        base: draft.base,
        addition: draft.addition,
        result,
      };
      break;
    case JSON_RECIPE: {
      let data: unknown;
      try {
        data = JSON.parse(draft.text);
      } catch {
        return { ok: false, error: "invalidJson" };
      }
      candidate = { type: JSON_RECIPE, data };
      break;
    }
    default:
      if (!draft.ingredient) return { ok: false, error: "incomplete" };
      candidate = {
        type: draft.type,
        ingredient: draft.ingredient,
        result,
        experience: draft.experience,
        cookingTime: draft.cookingTime,
      };
  }
  const parsed = editableRecipeSchema.safeParse(candidate);
  return parsed.success
    ? { ok: true, recipe: parsed.data }
    : { ok: false, error: "invalid" };
}

/** All values of an ingredient (one, or the alternatives). */
export const ingredientValues = (ingredient: Ingredient): IngredientValue[] =>
  Array.isArray(ingredient) ? ingredient : [ingredient];
