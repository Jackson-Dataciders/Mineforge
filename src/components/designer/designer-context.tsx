"use client";

import { createContext, use, type ReactNode } from "react";
import type { ItemLookup } from "@/components/recipes/recipe-slot";
import type { CustomRecipeType } from "@/domain/custom-recipe";
import type { EntryType } from "@/domain/entry";
import type { SearchItem } from "@/domain/item-search";

/** What the entry form shows about the mod's other entries. */
export type EntrySummary = { id: string; name: string; type: EntryType };

export type DesignerData = {
  modId: string;
  items: readonly SearchItem[];
  tags: readonly string[];
  lookup: ItemLookup;
  entries: readonly EntrySummary[];
  recipeTypes: readonly CustomRecipeType[];
};

const DesignerContext = createContext<DesignerData | null>(null);

export function DesignerProvider({
  value,
  children,
}: {
  value: DesignerData;
  children: ReactNode;
}) {
  return <DesignerContext value={value}>{children}</DesignerContext>;
}

/** The custom mod's item set, entries and recipe types (entry form only). */
export function useDesigner(): DesignerData {
  const value = use(DesignerContext);
  if (!value)
    throw new Error("useDesigner must be used inside <DesignerProvider>");
  return value;
}
