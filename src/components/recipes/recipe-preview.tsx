"use client";

import { ArrowRight } from "lucide-react";
import {
  JSON_RECIPE,
  parseVisualRecipe,
  SHAPED,
  SHAPELESS,
  SMITHING,
  type EditableRecipe,
  type Ingredient,
} from "@/domain/recipe";
import { useT } from "@/i18n/client";
import { IngredientSlot, type ItemLookup } from "./recipe-slot";

/** Read-only view of a raw recipe: visual if the editor can show it, else its JSON. */
export function RawRecipePreview({
  data,
  lookup,
}: {
  data: Record<string, unknown>;
  lookup: ItemLookup;
}) {
  const visual = parseVisualRecipe(data);
  return (
    <RecipePreview
      recipe={visual ?? { type: JSON_RECIPE, data }}
      lookup={lookup}
    />
  );
}

/** Read-only view of an editable recipe. */
export function RecipePreview({
  recipe,
  lookup,
}: {
  recipe: EditableRecipe;
  lookup: ItemLookup;
}) {
  const t = useT();
  if (recipe.type === JSON_RECIPE) {
    return (
      <pre className="max-h-48 overflow-auto rounded-md border border-border bg-bg p-2 font-mono text-xs text-text">
        {JSON.stringify(recipe.data, null, 2)}
      </pre>
    );
  }
  const slot = (ingredient: Ingredient | null, label?: string) => (
    <IngredientSlot ingredient={ingredient} lookup={lookup} label={label} />
  );
  let inputs;
  if (recipe.type === SHAPED) {
    inputs = (
      <div className="grid w-fit grid-cols-3 gap-1">
        {recipe.pattern.map((cell, i) => (
          <span key={i}>{slot(cell, t("recipe.cell", { n: i + 1 }))}</span>
        ))}
      </div>
    );
  } else if (recipe.type === SHAPELESS) {
    inputs = (
      <div className="grid w-fit grid-cols-3 gap-1">
        {recipe.ingredients.map((ingredient, i) => (
          <span key={i}>
            {slot(ingredient, t("recipe.cell", { n: i + 1 }))}
          </span>
        ))}
      </div>
    );
  } else if (recipe.type === SMITHING) {
    inputs = (
      <div className="flex gap-1">
        {slot(recipe.template, t("recipe.template"))}
        {slot(recipe.base, t("recipe.base"))}
        {slot(recipe.addition, t("recipe.addition"))}
      </div>
    );
  } else {
    inputs = slot(recipe.ingredient, t("recipe.ingredient"));
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {inputs}
      <ArrowRight className="size-5 shrink-0 text-muted" aria-hidden />
      <IngredientSlot
        ingredient={{ item: recipe.result.id }}
        lookup={lookup}
        label={t("recipe.result")}
        count={recipe.result.count}
      />
      {"cookingTime" in recipe && (
        <span className="text-sm text-muted">
          {t("recipe.experience")}: {recipe.experience} ·{" "}
          {t("recipe.cookingTime")}: {recipe.cookingTime}
        </span>
      )}
    </div>
  );
}
