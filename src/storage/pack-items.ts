import type { CustomMod } from "@/domain/custom-mod";
import {
  entrySearchItems,
  searchSetOf,
  type ItemSource,
} from "@/domain/item-sources";
import type { SearchItem, SearchSet } from "@/domain/item-search";
import type { Modpack } from "@/domain/modpack";
import { getCustomMod } from "./custom-mods";
import type { Versioned } from "./documents";
import { listEntries } from "./entries";
import { loadItemSources } from "./library";
import { getModpack } from "./modpacks";
import { NotFoundError, type StorageBackend } from "./types";

/** Library and vanilla sources plus entry items: everything an item set holds. */
export type ItemSet = {
  sources: ItemSource[];
  entryItems: SearchItem[];
};

export const searchSetOfItemSet = (set: ItemSet): SearchSet =>
  searchSetOf(set.sources, set.entryItems);

/** The item (if any) with this ID in a set; entries first. */
export function findItem(
  set: ItemSet,
  id: string,
): { id: string; name: string } | undefined {
  return (
    set.entryItems.find((i) => i.id === id) ??
    set.sources.flatMap((s) => s.items).find((i) => i.id === id)
  );
}

/**
 * A modpack's item set (spec 03, extended by spec 04): vanilla, the pack's
 * library mods, and planned or implemented item/block entries of the pack's
 * custom mods.
 */
export async function loadPackItemSources(
  storage: StorageBackend,
  packId: string,
): Promise<{ pack: Versioned<Modpack> } & ItemSet> {
  const pack = await getModpack(storage, packId);
  if (!pack) throw new NotFoundError(`modpack ${packId}`);
  const [sources, entryLists] = await Promise.all([
    loadItemSources(storage, pack.data.libraryModIds),
    Promise.all(
      pack.data.customModIds.map(async (modId) => {
        const mod = await getCustomMod(storage, modId);
        if (!mod) return [];
        const entries = await listEntries(storage, modId);
        return entrySearchItems(
          entries.map((e) => e.data),
          mod.data.name,
          ["planned", "implemented"],
        );
      }),
    ),
  ]);
  return { pack, sources, entryItems: entryLists.flat() };
}

/**
 * A custom mod's item set (spec 04): vanilla, its declared library
 * dependencies, and all of its item/block entries.
 */
export async function loadDesignerItemSources(
  storage: StorageBackend,
  modId: string,
): Promise<{ mod: Versioned<CustomMod> } & ItemSet> {
  const mod = await getCustomMod(storage, modId);
  if (!mod) throw new NotFoundError(`custom mod ${modId}`);
  const [sources, entries] = await Promise.all([
    loadItemSources(storage, mod.data.dependencies),
    listEntries(storage, modId),
  ]);
  return {
    mod,
    sources,
    entryItems: entrySearchItems(
      entries.map((e) => e.data),
      mod.data.name,
    ),
  };
}
