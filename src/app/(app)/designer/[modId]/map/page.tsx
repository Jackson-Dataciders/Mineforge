import { notFound } from "next/navigation";
import { ModHeader } from "@/components/designer/mod-header";
import { MindMap, type OutsideItem } from "@/components/mind-map/mind-map";
import { buildMindMap } from "@/domain/mind-map";
import { requireUser } from "@/server/session";
import { getStorage, loadCustomMods } from "@/storage";
import { readLayout } from "@/storage/layout";
import {
  loadDesignerItemSources,
  searchSetOfItemSet,
} from "@/storage/pack-items";
import { listEntries } from "@/storage/entries";

/** The custom mod's mind map (spec 06). */
export default async function MindMapPage({
  params,
}: PageProps<"/designer/[modId]/map">) {
  await requireUser();
  const { modId } = await params;
  const mod = (await loadCustomMods()).find((m) => m.data.modId === modId);
  if (!mod) notFound();
  const storage = await getStorage();
  const [entries, layout, itemSet] = await Promise.all([
    listEntries(storage, modId),
    readLayout(storage, modId),
    loadDesignerItemSources(storage, modId),
  ]);
  const map = buildMindMap(
    entries.map((e) => e.data),
    mod.data.recipeTypes,
  );
  // Names and icons of outside ingredients from the designer's item set.
  const known = new Map(
    searchSetOfItemSet(itemSet).items.map((i) => [i.id, i]),
  );
  const items: Record<string, OutsideItem> = {};
  for (const node of map.nodes) {
    if (node.kind !== "item") continue;
    const item = known.get(node.id);
    items[node.id] = {
      name: item?.name ?? node.id,
      icon: item?.icon ?? null,
      modName: item?.modName ?? null,
      missing: !item || item.missing === true,
    };
  }
  // Fresh server data (after a reload or conflict) remounts the map.
  const version = [mod.sha, layout.sha, ...entries.map((e) => e.sha)].join("|");
  return (
    <div className="flex flex-col gap-4">
      <div className="max-w-5xl">
        <ModHeader
          key={mod.sha}
          modId={modId}
          name={mod.data.name}
          phase={mod.data.phase}
          sha={mod.sha}
        />
      </div>
      <MindMap
        key={version}
        modId={modId}
        modName={mod.data.name}
        map={map}
        items={items}
        initialLayout={layout}
      />
    </div>
  );
}
