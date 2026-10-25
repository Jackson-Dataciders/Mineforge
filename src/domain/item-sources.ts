import { compareCodeUnits } from "@/lib/stable-json";
import type { SearchItem, SearchSet } from "./item-search";
import type {
  DataSource,
  ItemTags,
  LibraryItem,
  LibraryRecipe,
} from "./library";
import { recipeOutputIds } from "./recipe";

/** Vanilla or one library mod's data, as a modpack's item set uses it. */
export type ItemSource = {
  /** Library mod ID, or `null` for vanilla. */
  modId: string | null;
  modName: string;
  items: readonly LibraryItem[];
  recipes: readonly LibraryRecipe[];
  tags: ItemTags;
};

export const VANILLA_MOD_NAME = "Minecraft";

/**
 * The searchable items and tags of a set of sources. An item ID found in
 * several sources keeps its first occurrence (vanilla comes first).
 */
export function searchSetOf(sources: readonly ItemSource[]): SearchSet {
  const items = new Map<string, SearchItem>();
  const tags = new Set<string>();
  for (const source of sources) {
    for (const item of source.items) {
      if (items.has(item.id)) continue;
      items.set(item.id, {
        id: item.id,
        name: item.name,
        icon: item.icon,
        source: item.source,
        modName: source.modName,
      });
    }
    for (const tag of Object.keys(source.tags)) tags.add(tag);
  }
  return {
    items: [...items.values()].sort((a, b) => compareCodeUnits(a.id, b.id)),
    tags: [...tags].sort(compareCodeUnits),
  };
}

/** An existing recipe, with where it comes from. */
export type SourcedRecipe = {
  id: string;
  type: string;
  source: DataSource;
  evidence?: string;
  data: Record<string, unknown>;
  modName: string;
};

/**
 * Every recipe in the sources whose outputs contain the item, sorted by ID.
 * A later source's recipe replaces an earlier one with the same ID, as mod
 * data loads after vanilla in the game.
 */
export function recipesProducing(
  sources: readonly ItemSource[],
  itemId: string,
): SourcedRecipe[] {
  const byId = new Map<string, SourcedRecipe>();
  for (const source of sources) {
    for (const recipe of source.recipes) {
      byId.set(recipe.id, {
        id: recipe.id,
        type: recipe.type,
        source: recipe.source,
        ...(recipe.evidence ? { evidence: recipe.evidence } : {}),
        data: recipe.data,
        modName: source.modName,
      });
    }
  }
  return [...byId.values()]
    .filter((recipe) => recipeOutputIds(recipe.data).includes(itemId))
    .sort((a, b) => compareCodeUnits(a.id, b.id));
}
