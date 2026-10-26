import { compareCodeUnits } from "@/lib/stable-json";
import { isItemEntry, type Entry } from "./entry";
import { splitEntryId } from "./entry-id";
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
export function searchSetOf(
  sources: readonly ItemSource[],
  entryItems: readonly SearchItem[] = [],
): SearchSet {
  const items = new Map<string, SearchItem>(entryItems.map((i) => [i.id, i]));
  const tags = new Set<string>();
  for (const source of sources) {
    for (const item of source.items) {
      if (items.has(item.id)) continue;
      items.set(item.id, {
        id: item.id,
        name: item.name,
        icon: item.icon ? { kind: "texture", path: item.icon } : null,
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

/** Path of an entry's drawn icon under `assets/icons/`. */
export function entryIconPath(entryId: string): string {
  const { modId, path } = splitEntryId(entryId);
  return `${modId}/${path}.png`;
}

/**
 * Item and block entries as search items (ADR 0021), optionally only those
 * with one of the given statuses.
 */
export function entrySearchItems(
  entries: readonly Entry[],
  modName: string,
  statuses?: readonly Entry["status"][],
): SearchItem[] {
  return entries
    .filter(isItemEntry)
    .filter((e) => !statuses || statuses.includes(e.status))
    .map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon
        ? { kind: "icon" as const, path: entryIconPath(e.id) }
        : null,
      source: "entry" as const,
      status: e.status,
      modName,
    }));
}
