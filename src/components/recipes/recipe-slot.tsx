"use client";

import { ItemIcon } from "@/components/items/item-icon";
import type { SearchItem } from "@/domain/item-search";
import { ingredientValues, type Ingredient } from "@/domain/recipe";
import { useT } from "@/i18n/client";
import type { Translate } from "@/i18n/types";

/** Finds an item of the current set by ID (for names and icons). */
export type ItemLookup = (id: string) => SearchItem | undefined;

/** Accessible description of an ingredient: item name, tag, or alternatives. */
export function describeIngredient(
  ingredient: Ingredient | null,
  lookup: ItemLookup,
  t: Translate,
): string {
  if (!ingredient) return t("recipe.emptySlot");
  const [first, ...rest] = ingredientValues(ingredient);
  const one =
    first && "item" in first
      ? (lookup(first.item)?.name ?? first.item)
      : t("recipe.tag", { tag: first?.tag ?? "" });
  return rest.length > 0
    ? t("recipe.alternatives", { first: one, count: rest.length })
    : one;
}

/**
 * One recipe slot (`slot` color; accent outline when selected). Shows the
 * first value of an ingredient, with "+N" for alternatives. Clickable only
 * if `onClick` is given.
 */
export function IngredientSlot({
  ingredient,
  lookup,
  label,
  onClick,
  selected = false,
  count,
}: {
  ingredient: Ingredient | null;
  lookup: ItemLookup;
  /** Accessible name prefix, e.g. "Slot 3". */
  label?: string;
  onClick?: () => void;
  selected?: boolean;
  /** Shown bottom-right for results with a count above 1. */
  count?: number;
}) {
  const t = useT();
  const values = ingredient ? ingredientValues(ingredient) : [];
  const first = values[0];
  const description = describeIngredient(ingredient, lookup, t);
  const missing = values.some((v) => "item" in v && lookup(v.item)?.missing);
  const name = label ? `${label}: ${description}` : description;
  const content = (
    <>
      {first &&
        ("item" in first ? (
          <ItemIcon icon={lookup(first.item)?.icon} size={32} />
        ) : (
          <ItemIcon icon={null} kind="tag" size={32} />
        ))}
      {values.length > 1 && (
        <span className="absolute top-0 right-0.5 text-xs font-semibold text-text">
          +{values.length - 1}
        </span>
      )}
      {count !== undefined && count > 1 && (
        <span className="absolute right-0.5 bottom-0 text-xs font-semibold text-text">
          {count}
        </span>
      )}
    </>
  );
  const className = `relative inline-flex size-12 shrink-0 items-center justify-center rounded-md border bg-slot ${missing ? "border-2 border-danger" : "border-border"} ${
    selected ? "outline-2 outline-offset-1 outline-accent" : ""
  }`;
  if (!onClick) {
    return (
      <span
        role="img"
        aria-label={name}
        title={description}
        className={className}
      >
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      title={description}
      className={`${className} hover:border-accent focus-visible:outline-2 focus-visible:outline-accent`}
    >
      {content}
    </button>
  );
}
