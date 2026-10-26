"use client";

import { ArrowRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  ItemSearchDialog,
  type ItemSelection,
} from "@/components/items/item-search-dialog";
import type { SearchItem } from "@/domain/item-search";
import {
  JSON_RECIPE,
  MAX_RESULT_COUNT,
  SHAPED,
  SHAPELESS,
  SMITHING,
  STONECUTTING,
  type Ingredient,
  type RecipeDraft,
} from "@/domain/recipe";
import { useT } from "@/i18n/client";
import { IngredientSlot, type ItemLookup } from "./recipe-slot";

const toIngredient = (selection: ItemSelection): Ingredient =>
  selection.kind === "item"
    ? { item: selection.item.id }
    : { tag: selection.tag };

/** Ingredient slot fields of non-grid drafts. */
type SlotField = "ingredient" | "template" | "base" | "addition";
type OpenSlot = { kind: "cell"; index: number } | { kind: SlotField } | null;

/**
 * Visual editor for one recipe draft (spec 03): 3×3 grid for crafting,
 * single slots for cooking, stonecutting and smithing, a JSON text area for
 * any other type. The result is always the change's item; only its count is
 * editable. Slots open the shared item search modal with items and tags.
 */
export function RecipeEditor({
  draft,
  onChange,
  items,
  tags,
  lookup,
  resultItem,
}: {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  items: readonly SearchItem[];
  tags: readonly string[];
  lookup: ItemLookup;
  resultItem: SearchItem | { id: string; name: string; icon: null };
}) {
  const t = useT();
  const [open, setOpen] = useState<OpenSlot>(null);

  if (draft.type === JSON_RECIPE) {
    return (
      <JsonEditor
        text={draft.text}
        onChange={(text) => onChange({ type: JSON_RECIPE, text })}
      />
    );
  }

  const setSlot = (slot: NonNullable<OpenSlot>, value: Ingredient | null) => {
    if (slot.kind === "cell") {
      if (draft.type !== SHAPED && draft.type !== SHAPELESS) return;
      const cells = [...draft.cells];
      cells[slot.index] = value;
      onChange({ ...draft, cells });
    } else {
      onChange({ ...draft, [slot.kind]: value } as RecipeDraft);
    }
  };

  const slotButton = (slot: NonNullable<OpenSlot>, label: string) => {
    const value =
      slot.kind === "cell"
        ? "cells" in draft
          ? (draft.cells[slot.index] ?? null)
          : null
        : ((draft as Record<string, unknown>)[slot.kind] as Ingredient | null);
    const isOpen =
      open !== null &&
      open.kind === slot.kind &&
      (slot.kind !== "cell" ||
        (open.kind === "cell" && open.index === slot.index));
    return (
      <IngredientSlot
        ingredient={value}
        lookup={lookup}
        label={label}
        selected={isOpen}
        onClick={() => setOpen(slot)}
      />
    );
  };

  let inputs: ReactNode;
  if (draft.type === SHAPED || draft.type === SHAPELESS) {
    inputs = (
      <div
        role="group"
        aria-label={t("recipe.grid")}
        className="grid w-fit grid-cols-3 gap-1"
      >
        {draft.cells.map((_, index) => (
          <span key={index}>
            {slotButton(
              { kind: "cell", index },
              t("recipe.cell", { n: index + 1 }),
            )}
          </span>
        ))}
      </div>
    );
  } else if (draft.type === SMITHING) {
    inputs = (
      <div className="flex gap-2">
        {(["template", "base", "addition"] as const).map((field) => (
          <LabeledSlot key={field} label={t(`recipe.${field}`)}>
            {slotButton({ kind: field }, t(`recipe.${field}`))}
          </LabeledSlot>
        ))}
      </div>
    );
  } else {
    inputs = (
      <LabeledSlot label={t("recipe.ingredient")}>
        {slotButton({ kind: "ingredient" }, t("recipe.ingredient"))}
      </LabeledSlot>
    );
  }

  const isCooking =
    draft.type !== STONECUTTING &&
    draft.type !== SMITHING &&
    draft.type !== SHAPED &&
    draft.type !== SHAPELESS;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {inputs}
        <ArrowRight className="size-6 shrink-0 text-muted" aria-hidden />
        <LabeledSlot label={t("recipe.result")}>
          <IngredientSlot
            ingredient={{ item: resultItem.id }}
            lookup={(id) =>
              id === resultItem.id ? (resultItem as SearchItem) : lookup(id)
            }
            label={t("recipe.result")}
            count={draft.count}
          />
        </LabeledSlot>
      </div>

      <div className="flex flex-wrap gap-3">
        <NumberField
          label={t("recipe.count")}
          value={draft.count}
          min={1}
          max={MAX_RESULT_COUNT}
          step={1}
          onChange={(count) => onChange({ ...draft, count })}
        />
        {isCooking && "experience" in draft && (
          <>
            <NumberField
              label={t("recipe.experience")}
              value={draft.experience}
              min={0}
              max={10000}
              step={0.05}
              onChange={(experience) => onChange({ ...draft, experience })}
            />
            <NumberField
              label={t("recipe.cookingTime")}
              value={draft.cookingTime}
              min={1}
              max={1000000}
              step={1}
              onChange={(cookingTime) => onChange({ ...draft, cookingTime })}
            />
          </>
        )}
      </div>

      {open && (
        <ItemSearchDialog
          open
          onClose={() => setOpen(null)}
          title={t("itemSearch.ingredientTitle")}
          items={items}
          tags={tags}
          allowTags
          onSelect={(selection) => setSlot(open, toIngredient(selection))}
          onClear={() => setSlot(open, null)}
        />
      )}
    </div>
  );
}

function LabeledSlot({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="flex flex-col items-center gap-1">
      {children}
      <span aria-hidden className="text-xs text-muted">
        {label}
      </span>
    </span>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="min-h-11 w-32 rounded-md border border-border bg-bg px-3 text-base text-text"
      />
    </div>
  );
}

function JsonEditor({
  text,
  onChange,
}: {
  text: string;
  onChange: (text: string) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {t("recipe.json")}
      </label>
      <textarea
        id={id}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={14}
        aria-describedby={`${id}-hint`}
        className="min-h-48 w-full rounded-md border border-border bg-bg p-3 font-mono text-base text-text"
      />
      <p id={`${id}-hint`} className="text-sm text-muted">
        {t("recipe.jsonHint")}
      </p>
    </div>
  );
}
