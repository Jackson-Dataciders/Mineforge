"use client";

import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import {
  ItemSearchDialog,
  type ItemSelection,
} from "@/components/items/item-search-dialog";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { RecipePreview } from "@/components/recipes/recipe-preview";
import { IngredientSlot } from "@/components/recipes/recipe-slot";
import { recipeTypeKey } from "@/components/recipes/recipe-type-key";
import { Button, IconButton } from "@/components/ui/button";
import { NumberField } from "@/components/ui/form-fields";
import { TextField } from "@/components/ui/field";
import {
  customDraftToRecipe,
  customRecipeProblem,
  customRecipeToDraft,
  emptyCustomDraft,
  type CustomInputDraft,
  type CustomOutputDraft,
  type CustomRecipe,
  type CustomRecipeDraft,
  type CustomRecipeType,
} from "@/domain/custom-recipe";
import type { EntryRecipe } from "@/domain/entry";
import {
  draftToRecipe,
  emptyDraft,
  JSON_RECIPE,
  recipeToDraft,
  VISUAL_RECIPE_TYPES,
  type Ingredient,
  type RecipeDraft,
  type VisualRecipeType,
} from "@/domain/recipe";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/types";
import { useDesigner } from "./designer-context";

type Editing = {
  /** `null` while adding a new recipe. */
  index: number | null;
  draft: RecipeDraft | CustomRecipeDraft;
};

const isCustomDraft = (
  draft: RecipeDraft | CustomRecipeDraft,
): draft is CustomRecipeDraft => draft.type === "custom";

/**
 * Recipes on an item or block entry (spec 04): phase 3 visual and JSON
 * recipes whose result is the entry, and recipes of the mod's custom machine
 * recipe types with a generated editor.
 */
export function EntryRecipes({
  entryId,
  entryName,
  recipes,
  onChange,
}: {
  entryId: string;
  entryName: string;
  recipes: EntryRecipe[];
  onChange: (recipes: EntryRecipe[]) => void;
}) {
  const t = useT();
  const selectId = useId();
  const { items, tags, lookup, recipeTypes } = useDesigner();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [newType, setNewType] = useState<string>(VISUAL_RECIPE_TYPES[0]);
  const [error, setError] = useState<string>();
  const typeOf = (id: string) => recipeTypes.find((type) => type.id === id);
  const resultItem = lookup(entryId) ?? {
    id: entryId,
    name: entryName,
    icon: null,
  };

  function startNew() {
    setError(undefined);
    if (newType.startsWith("custom:")) {
      const type = typeOf(newType.slice(7));
      if (type)
        setEditing({ index: null, draft: emptyCustomDraft(type, entryId) });
    } else {
      setEditing({
        index: null,
        draft: emptyDraft(newType as VisualRecipeType | "json"),
      });
    }
  }

  function startEdit(index: number) {
    const recipe = recipes[index]!;
    setError(undefined);
    setEditing({
      index,
      draft:
        recipe.type === "custom"
          ? customRecipeToDraft(recipe, typeOf(recipe.recipeType))
          : recipeToDraft(recipe),
    });
  }

  function apply() {
    if (!editing) return;
    let result:
      { ok: true; recipe: EntryRecipe } | { ok: false; error: string };
    if (isCustomDraft(editing.draft)) {
      const type = typeOf(editing.draft.recipeType);
      result = type
        ? customDraftToRecipe(editing.draft, type)
        : { ok: false, error: "slotType" };
    } else {
      result = draftToRecipe(editing.draft, entryId);
    }
    if (!result.ok) {
      setError(t(`designer.recipes.problems.${result.error}` as MessageKey));
      return;
    }
    const recipe = result.recipe;
    onChange(
      editing.index === null
        ? [...recipes, recipe]
        : recipes.map((r, i) => (i === editing.index ? recipe : r)),
    );
    setEditing(null);
  }

  const typeLabel = (recipe: EntryRecipe) =>
    recipe.type === "custom"
      ? (typeOf(recipe.recipeType)?.name ?? recipe.recipeType)
      : t(recipeTypeKey(recipe.type));

  return (
    <div className="flex flex-col gap-3">
      {recipes.length === 0 && !editing && (
        <p className="text-sm text-muted">{t("designer.recipes.none")}</p>
      )}
      {recipes.map((recipe, index) =>
        editing?.index === index ? null : (
          <div
            key={index}
            className="flex flex-col gap-2 rounded-md border border-border p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">
                {typeLabel(recipe)}
              </span>
              <IconButton
                label={t("designer.recipes.edit")}
                onClick={() => startEdit(index)}
                disabled={editing !== null}
              >
                <Pencil className="size-4" aria-hidden />
              </IconButton>
              <IconButton
                label={t("designer.recipes.remove")}
                disabled={editing !== null}
                onClick={() => onChange(recipes.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </div>
            {recipe.type === "custom" ? (
              <CustomRecipePreview
                recipe={recipe}
                type={typeOf(recipe.recipeType)}
              />
            ) : (
              <RecipePreview recipe={recipe} lookup={lookup} />
            )}
          </div>
        ),
      )}

      {editing ? (
        <div className="flex flex-col gap-3 rounded-md border border-accent p-3">
          {isCustomDraft(editing.draft) ? (
            <CustomRecipeEditor
              draft={editing.draft}
              type={typeOf(editing.draft.recipeType)}
              onChange={(draft) => setEditing({ ...editing, draft })}
            />
          ) : (
            <RecipeEditor
              draft={editing.draft}
              onChange={(draft) => setEditing({ ...editing, draft })}
              items={items}
              tags={tags}
              lookup={lookup}
              resultItem={resultItem}
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setEditing(null)}>
              {t("designer.recipes.cancel")}
            </Button>
            <Button variant="primary" onClick={apply}>
              {t("designer.recipes.apply")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex max-w-full min-w-0 flex-col gap-1">
            <label htmlFor={selectId} className="text-sm font-medium">
              {t("designer.recipes.type")}
            </label>
            <select
              id={selectId}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="min-h-11 w-full rounded-md border border-border bg-bg px-2 text-base text-text"
            >
              {[...VISUAL_RECIPE_TYPES, JSON_RECIPE].map((type) => (
                <option key={type} value={type}>
                  {t(recipeTypeKey(type as VisualRecipeType | "json"))}
                </option>
              ))}
              {recipeTypes.map((type) => (
                <option key={type.id} value={`custom:${type.id}`}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={startNew}>
            <Plus className="size-4" aria-hidden />
            {t("designer.recipes.add")}
          </Button>
        </div>
      )}
    </div>
  );
}

function CustomRecipePreview({
  recipe,
  type,
}: {
  recipe: CustomRecipe;
  type: CustomRecipeType | undefined;
}) {
  const t = useT();
  const { lookup } = useDesigner();
  const problem = type ? customRecipeProblem(recipe, type) : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {recipe.inputs.map((input, i) =>
          input.type === "item" ? (
            <IngredientSlot
              key={i}
              ingredient={input.ingredient}
              lookup={lookup}
            />
          ) : (
            <span
              key={i}
              className="rounded-md border border-border px-2 py-1 text-xs"
            >
              {input.type === "fluid"
                ? t("designer.recipes.fluidAmount", {
                    amount: input.amount,
                    fluid: input.fluid,
                  })
                : t("designer.recipes.energyAmount", { amount: input.amount })}
            </span>
          ),
        )}
        <ArrowRight className="size-5 text-muted" aria-hidden />
        {recipe.outputs.map((out, i) =>
          out.type === "item" ? (
            <span key={i} className="flex items-center gap-1">
              <IngredientSlot
                ingredient={{ item: out.item }}
                lookup={lookup}
                count={out.count}
              />
              {out.chance !== undefined && (
                <span className="text-xs text-muted">
                  {t("designer.recipes.percent", {
                    value: Math.round(out.chance * 100),
                  })}
                </span>
              )}
            </span>
          ) : (
            <span
              key={i}
              className="rounded-md border border-border px-2 py-1 text-xs"
            >
              {t("designer.recipes.fluidAmount", {
                amount: out.amount,
                fluid: out.fluid,
              })}
              {out.chance !== undefined
                ? ` · ${t("designer.recipes.percent", { value: Math.round(out.chance * 100) })}`
                : ""}
            </span>
          ),
        )}
      </div>
      {!type && (
        <p className="text-sm text-danger">
          {t("designer.recipes.missingType", { id: recipe.recipeType })}
        </p>
      )}
      {problem && (
        <p className="text-sm text-danger">{t("designer.recipes.mismatch")}</p>
      )}
    </div>
  );
}

/** Editor generated from a custom recipe type's slot definition. */
function CustomRecipeEditor({
  draft,
  type,
  onChange,
}: {
  draft: CustomRecipeDraft;
  type: CustomRecipeType | undefined;
  onChange: (draft: CustomRecipeDraft) => void;
}) {
  const t = useT();
  const { items, tags, lookup } = useDesigner();
  const [picking, setPicking] = useState<{
    side: "in" | "out";
    index: number;
  } | null>(null);

  if (!type) {
    return (
      <p className="text-sm text-danger">
        {t("designer.recipes.missingType", { id: draft.recipeType })}
      </p>
    );
  }

  const setInput = (index: number, value: CustomInputDraft) =>
    onChange({
      ...draft,
      inputs: draft.inputs.map((v, i) => (i === index ? value : v)),
    });
  const setOutput = (index: number, value: CustomOutputDraft) =>
    onChange({
      ...draft,
      outputs: draft.outputs.map((v, i) => (i === index ? value : v)),
    });

  // An edited recipe whose type changed: rebuild the slots from the type.
  const matches =
    draft.inputs.length === type.inputs.length &&
    draft.outputs.length === type.outputs.length &&
    draft.inputs.every((v, i) => v.type === type.inputs[i]!.type) &&
    draft.outputs.every(
      (v, i) =>
        v.type === type.outputs[i]!.type &&
        (v.chance !== undefined) === type.outputs[i]!.chance,
    ) &&
    (draft.processingTime !== undefined) === type.parameters.processingTime &&
    (draft.energyCost !== undefined) === type.parameters.energyCost;
  if (!matches) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-danger">{t("designer.recipes.mismatch")}</p>
        <div>
          <Button
            onClick={() =>
              onChange(
                emptyCustomDraft(
                  type,
                  draft.outputs.find((o) => o.type === "item")?.item ?? null,
                ),
              )
            }
          >
            {t("designer.recipes.edit")}
          </Button>
        </div>
      </div>
    );
  }

  const choose = (selection: ItemSelection) => {
    if (!picking) return;
    if (picking.side === "in") {
      const ingredient: Ingredient =
        selection.kind === "item"
          ? { item: selection.item.id }
          : { tag: selection.tag };
      setInput(picking.index, { type: "item", ingredient });
    } else if (selection.kind === "item") {
      const current = draft.outputs[picking.index]!;
      if (current.type === "item")
        setOutput(picking.index, { ...current, item: selection.item.id });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{type.name}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          {t("designer.recipes.inputs")}
        </legend>
        {draft.inputs.map((input, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            {input.type === "item" && (
              <IngredientSlot
                ingredient={input.ingredient}
                lookup={lookup}
                label={t("designer.recipeTypes.slot", { n: index + 1 })}
                selected={picking?.side === "in" && picking.index === index}
                onClick={() => setPicking({ side: "in", index })}
              />
            )}
            {input.type === "fluid" && (
              <>
                <TextField
                  label={t("designer.recipes.fluid")}
                  value={input.fluid}
                  placeholder="minecraft:water"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputClassName="font-mono"
                  onChange={(e) =>
                    setInput(index, {
                      ...input,
                      fluid: e.target.value.trim().toLowerCase(),
                    })
                  }
                  className="min-w-0 flex-1 basis-48"
                />
                <NumberField
                  label={t("designer.recipes.amount")}
                  value={input.amount}
                  min={1}
                  onChange={(amount) => setInput(index, { ...input, amount })}
                  className="w-32"
                />
              </>
            )}
            {input.type === "energy" && (
              <NumberField
                label={t("designer.recipes.energy")}
                value={input.amount}
                min={1}
                onChange={(amount) => setInput(index, { ...input, amount })}
                className="w-40"
              />
            )}
          </div>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">
          {t("designer.recipes.outputs")}
        </legend>
        {draft.outputs.map((out, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            {out.type === "item" ? (
              <>
                <IngredientSlot
                  ingredient={out.item ? { item: out.item } : null}
                  lookup={lookup}
                  label={t("designer.recipeTypes.slot", { n: index + 1 })}
                  selected={picking?.side === "out" && picking.index === index}
                  onClick={() => setPicking({ side: "out", index })}
                />
                <NumberField
                  label={t("designer.recipes.count")}
                  value={out.count}
                  min={1}
                  max={99}
                  onChange={(count) => setOutput(index, { ...out, count })}
                  className="w-24"
                />
              </>
            ) : (
              <>
                <TextField
                  label={t("designer.recipes.fluid")}
                  value={out.fluid}
                  autoCapitalize="off"
                  spellCheck={false}
                  inputClassName="font-mono"
                  onChange={(e) =>
                    setOutput(index, {
                      ...out,
                      fluid: e.target.value.trim().toLowerCase(),
                    })
                  }
                  className="min-w-0 flex-1 basis-48"
                />
                <NumberField
                  label={t("designer.recipes.amount")}
                  value={out.amount}
                  min={1}
                  onChange={(amount) => setOutput(index, { ...out, amount })}
                  className="w-32"
                />
              </>
            )}
            {out.chance !== undefined && (
              <NumberField
                label={t("designer.recipes.chance")}
                value={out.chance}
                min={0}
                max={1}
                step={0.05}
                onChange={(chance) => setOutput(index, { ...out, chance })}
                className="w-24"
              />
            )}
          </div>
        ))}
      </fieldset>
      {(type.parameters.processingTime || type.parameters.energyCost) && (
        <div className="flex flex-wrap gap-2">
          {type.parameters.processingTime && (
            <NumberField
              label={t("designer.recipeTypes.processingTime")}
              value={draft.processingTime ?? NaN}
              min={1}
              onChange={(processingTime) =>
                onChange({ ...draft, processingTime })
              }
              className="w-40"
            />
          )}
          {type.parameters.energyCost && (
            <NumberField
              label={t("designer.recipeTypes.energyCost")}
              value={draft.energyCost ?? NaN}
              min={1}
              onChange={(energyCost) => onChange({ ...draft, energyCost })}
              className="w-40"
            />
          )}
        </div>
      )}
      {picking && (
        <ItemSearchDialog
          open
          onClose={() => setPicking(null)}
          title={t(
            picking.side === "in"
              ? "itemSearch.ingredientTitle"
              : "itemSearch.title",
          )}
          items={items}
          tags={tags}
          allowTags={picking.side === "in"}
          onSelect={choose}
        />
      )}
    </div>
  );
}
