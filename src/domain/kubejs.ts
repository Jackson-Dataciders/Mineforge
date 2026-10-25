import { stableStringify } from "@/lib/stable-json";
import {
  JSON_RECIPE,
  SHAPED,
  SHAPELESS,
  SMITHING,
  STONECUTTING,
  type EditableRecipe,
  type Ingredient,
  type IngredientValue,
  type RecipeResult,
} from "./recipe";
import { removedRecipeId, type RecipeChange } from "./recipe-change";

/**
 * KubeJS 2101 (Minecraft 1.21.1) server script for one recipe change
 * (ADR 0008, 0018). Pure and deterministic. Syntax verified against the
 * KubeJS 2101 source (RecipesKubeEvent shortcuts and the recipe schemas in
 * data/minecraft/kubejs/recipe_schema).
 */

const str = (value: string) => JSON.stringify(value);

const valueString = (value: IngredientValue) =>
  "item" in value ? value.item : `#${value.tag}`;

function ingredientJs(ingredient: Ingredient): string {
  return Array.isArray(ingredient)
    ? `[${ingredient.map((v) => str(valueString(v))).join(", ")}]`
    : str(valueString(ingredient));
}

const resultJs = (result: RecipeResult) =>
  str(result.count > 1 ? `${result.count}x ${result.id}` : result.id);

const COOKING_FUNCTIONS: Record<string, string> = {
  "minecraft:smelting": "smelting",
  "minecraft:blasting": "blasting",
  "minecraft:smoking": "smoking",
  "minecraft:campfire_cooking": "campfireCooking",
};

const KEY_LETTERS = "ABCDEFGHI";

/** Shaped grid → trimmed pattern rows and a key per distinct ingredient. */
export function shapedPattern(cells: readonly (Ingredient | null)[]): {
  rows: string[];
  key: [string, Ingredient][];
} {
  const used = cells
    .map((cell, i) => (cell === null ? -1 : i))
    .filter((i) => i >= 0);
  const rowsUsed = used.map((i) => Math.floor(i / 3));
  const colsUsed = used.map((i) => i % 3);
  const [top, bottom] = [Math.min(...rowsUsed), Math.max(...rowsUsed)];
  const [left, right] = [Math.min(...colsUsed), Math.max(...colsUsed)];

  const letters = new Map<string, string>();
  const key: [string, Ingredient][] = [];
  const rows: string[] = [];
  for (let row = top; row <= bottom; row++) {
    let line = "";
    for (let col = left; col <= right; col++) {
      const cell = cells[row * 3 + col] ?? null;
      if (cell === null) {
        line += " ";
        continue;
      }
      const identity = stableStringify(cell);
      let letter = letters.get(identity);
      if (!letter) {
        letter = KEY_LETTERS[letters.size]!;
        letters.set(identity, letter);
        key.push([letter, cell]);
      }
      line += letter;
    }
    rows.push(line);
  }
  return { rows, key };
}

const indent = (text: string, prefix: string) =>
  text
    .split("\n")
    .map((line, i) => (i === 0 || line === "" ? line : prefix + line))
    .join("\n");

/** The recipe expression, without `.id(...)`; lines after the first are not indented. */
function recipeJs(recipe: EditableRecipe): string {
  switch (recipe.type) {
    case SHAPED: {
      const { rows, key } = shapedPattern(recipe.pattern);
      return [
        `event.shaped(${resultJs(recipe.result)}, [`,
        ...rows.map((row) => `  ${str(row)},`),
        "], {",
        ...key.map(([letter, ing]) => `  ${letter}: ${ingredientJs(ing)},`),
        "})",
      ].join("\n");
    }
    case SHAPELESS:
      return [
        `event.shapeless(${resultJs(recipe.result)}, [`,
        ...recipe.ingredients.map((ing) => `  ${ingredientJs(ing)},`),
        "])",
      ].join("\n");
    case STONECUTTING:
      return `event.stonecutting(${resultJs(recipe.result)}, ${ingredientJs(recipe.ingredient)})`;
    case SMITHING:
      return `event.smithing(${resultJs(recipe.result)}, ${ingredientJs(recipe.template)}, ${ingredientJs(recipe.base)}, ${ingredientJs(recipe.addition)})`;
    case JSON_RECIPE:
      return `event.custom(${stableStringify(recipe.data).trimEnd()})`;
    default:
      return `event.${COOKING_FUNCTIONS[recipe.type]}(${resultJs(recipe.result)}, ${ingredientJs(recipe.ingredient)}).xp(${recipe.experience}).cookingTime(${recipe.cookingTime})`;
  }
}

const CONTROL_CHARS = new RegExp("[\u0000-\u001f\u007f\u2028\u2029]+", "g");

/** One-line comment text: no line breaks or control characters. */
const commentText = (text: string) => text.replace(CONTROL_CHARS, " ");

function description(change: RecipeChange): string {
  const item = `${commentText(change.itemName)} (${change.item})`;
  switch (change.action) {
    case "add":
      return `Adds a recipe for ${item}.`;
    case "replace":
      return `Replaces ${change.replacedRecipeId} for ${item}.`;
    case "remove":
      return `Removes ${change.removedRecipeId} for ${item}.`;
  }
}

/** The KubeJS recipe ID of a change's new recipe. */
export const kubeJsRecipeId = (packId: string, change: RecipeChange) =>
  `${packId}:${change.id}`;

/** Download file name; stable per change, so re-exports replace the old file. */
export const scriptFileName = (packId: string, changeId: string) =>
  `${packId}-${changeId}.js`;

/** Complete server script for `kubejs/server_scripts/`. */
export function generateKubeJsScript(
  packId: string,
  change: RecipeChange,
): string {
  const body: string[] = [];
  const removed = removedRecipeId(change);
  if (removed) body.push(`event.remove({ id: ${str(removed)} })`);
  if (change.action !== "remove") {
    body.push(
      `${recipeJs(change.recipe)}.id(${str(kubeJsRecipeId(packId, change))})`,
    );
  }
  return [
    `// Mineforge modpack "${packId}", recipe change "${change.id}".`,
    `// ${description(change)}`,
    "// Place this file in kubejs/server_scripts/.",
    "",
    "ServerEvents.recipes(event => {",
    ...body.map((statement) => `  ${indent(statement, "  ")}`),
    "})",
    "",
  ].join("\n");
}
