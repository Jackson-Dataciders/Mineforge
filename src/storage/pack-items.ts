import type { ItemSource } from "@/domain/item-sources";
import type { Modpack } from "@/domain/modpack";
import type { Versioned } from "./documents";
import { loadItemSources } from "./library";
import { getModpack } from "./modpacks";
import { NotFoundError, type StorageBackend } from "./types";

/**
 * A modpack's item set (spec 03): vanilla plus the pack's library mods.
 * Planned and implemented entries of its custom mods join in phase 4.
 */
export async function loadPackItemSources(
  storage: StorageBackend,
  packId: string,
): Promise<{ pack: Versioned<Modpack>; sources: ItemSource[] }> {
  const pack = await getModpack(storage, packId);
  if (!pack) throw new NotFoundError(`modpack ${packId}`);
  return {
    pack,
    sources: await loadItemSources(storage, pack.data.libraryModIds),
  };
}
