import { Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ItemIcon } from "@/components/items/item-icon";
import type { Incompatibility } from "@/components/library/compat-badge";
import { PackMods } from "@/components/modpacks/pack-mods";
import { PackTaskList } from "@/components/modpacks/pack-tasks";
import { recipeTypeKey } from "@/components/recipes/recipe-type-key";
import { targetCompatibility } from "@/domain/compatibility";
import { missingDependencies } from "@/domain/dependencies";
import type { LibraryMeta } from "@/domain/library";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { getStorage, loadCustomMods, loadModpacks } from "@/storage";
import { loadLibraryMetas } from "@/storage/library";
import { loadPackItemSources, searchSetOfItemSet } from "@/storage/pack-items";
import { readPackTasks } from "@/storage/pack-tasks";
import { listRecipeChanges } from "@/storage/recipe-changes";

function incompatibilityOf(meta: LibraryMeta): Incompatibility | null {
  const result = targetCompatibility(meta);
  if (result.compatible) return null;
  return result.reason === "loader"
    ? { reason: "loader", loader: meta.loader }
    : { reason: "version", range: meta.minecraftVersionRange ?? "" };
}

export default async function ModpackPage({
  params,
}: PageProps<"/modpacks/[packId]">) {
  await requireUser();
  const { packId } = await params;
  const pack = (await loadModpacks()).find((p) => p.data.id === packId);
  if (!pack) notFound();
  const t = await getT();
  const storage = await getStorage();
  const [metas, customMods, changes, tasks, itemSet] = await Promise.all([
    loadLibraryMetas(storage),
    loadCustomMods(),
    listRecipeChanges(storage, packId),
    readPackTasks(storage, packId),
    loadPackItemSources(storage, packId),
  ]);

  const packLibrary = pack.data.libraryModIds
    .map((id) => metas.get(id))
    .filter((m): m is LibraryMeta => m !== undefined);
  const packCustom = customMods
    .map((m) => m.data)
    .filter((m) => pack.data.customModIds.includes(m.modId));
  const missing = missingDependencies(packLibrary, packCustom);
  const incompatible = packLibrary.filter((m) => incompatibilityOf(m));
  const icons = new Map(
    searchSetOfItemSet(itemSet).items.map((i) => [i.id, i.icon] as const),
  );
  const itemNames = Object.fromEntries(
    changes.map((c) => [c.data.id, c.data.itemName]),
  );
  const libraryOptions = [...metas.values()]
    .map((m) => ({
      id: m.modId,
      name: m.name,
      incompatibility: incompatibilityOf(m),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const customOptions = customMods.map((m) => ({
    id: m.data.modId,
    name: m.data.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">{pack.data.name}</h1>
        <p className="font-mono text-sm text-muted">
          {t("projects.idValue", { id: pack.data.id })}
        </p>
      </header>

      {(missing.length > 0 || incompatible.length > 0) && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-warning bg-surface p-3"
        >
          {missing.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <TriangleAlert className="size-5 text-warning" aria-hidden />
                {t("modpack.missingTitle")}
              </h2>
              <ul className="mt-1 list-disc pl-9">
                {missing.map((m) => (
                  <li key={m.modId}>
                    {t("modpack.missingItem", {
                      modId: m.modId,
                      mods: m.requiredBy.join(", "),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {incompatible.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <TriangleAlert className="size-5 text-warning" aria-hidden />
                {t("modpack.incompatibleTitle")}
              </h2>
              <ul className="mt-1 list-disc pl-9">
                {incompatible.map((m) => (
                  <li key={m.modId}>
                    {m.name} ({m.loader}
                    {m.minecraftVersionRange
                      ? `, ${m.minecraftVersionRange}`
                      : ""}
                    )
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <PackMods
            key={pack.sha}
            packId={packId}
            sha={pack.sha}
            libraryMods={libraryOptions}
            customMods={customOptions}
            libraryModIds={pack.data.libraryModIds}
            customModIds={pack.data.customModIds}
          />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {t("modpack.changesTitle")}
              </h2>
              <Link
                href={`/modpacks/${packId}/recipe-changes/new`}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-on-accent hover:ring-2 hover:ring-accent/40"
              >
                <Plus className="size-4" aria-hidden />
                {t("modpack.newChange")}
              </Link>
            </div>
            {changes.length === 0 ? (
              <p className="text-muted">{t("modpack.noChanges")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                {changes.map(({ data: change }) => (
                  <li key={change.id}>
                    <Link
                      href={`/modpacks/${packId}/recipe-changes/${change.id}`}
                      className="flex min-h-11 items-center gap-3 px-3 py-2 hover:bg-accent/13"
                    >
                      <ItemIcon icon={icons.get(change.item)} size={32} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{change.itemName}</span>
                        <span className="truncate text-xs text-muted">
                          {change.action === "remove"
                            ? change.removedRecipeId
                            : t(recipeTypeKey(change.recipe.type))}
                          {" · "}
                          <span className="font-mono">{change.id}</span>
                        </span>
                      </span>
                      <span className="rounded-full bg-surface">
                        <span className="block rounded-full bg-secondary/13 px-2 text-xs text-text">
                          {t(`recipeChange.actions.${change.action}`)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <PackTaskList
          key={tasks.sha ?? "none"}
          packId={packId}
          initial={tasks}
          itemNames={itemNames}
        />
      </div>
    </div>
  );
}
