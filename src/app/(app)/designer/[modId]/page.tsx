import { Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { EntrySummary } from "@/components/designer/designer-context";
import {
  ModDependencies,
  RecipeTypesSection,
} from "@/components/designer/mod-settings";
import { ItemIcon } from "@/components/items/item-icon";
import type { Incompatibility } from "@/components/library/compat-badge";
import { targetCompatibility } from "@/domain/compatibility";
import { ENTRY_TYPES, usedRecipeTypes, type EntryStatus } from "@/domain/entry";
import { entryIconPath } from "@/domain/item-sources";
import type { LibraryMeta } from "@/domain/library";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { getStorage, loadCustomMods } from "@/storage";
import { listEntries } from "@/storage/entries";
import { loadLibraryMetas } from "@/storage/library";

const STATUS_TINT: Record<EntryStatus, string> = {
  backlog: "bg-muted/13",
  planned: "bg-secondary/13",
  implemented: "bg-ok/13",
};

function incompatibilityOf(meta: LibraryMeta): Incompatibility | null {
  const result = targetCompatibility(meta);
  if (result.compatible) return null;
  return result.reason === "loader"
    ? { reason: "loader", loader: meta.loader }
    : { reason: "version", range: meta.minecraftVersionRange ?? "" };
}

/** A custom mod: its entries, dependencies and custom recipe types (spec 04). */
export default async function CustomModPage({
  params,
}: PageProps<"/designer/[modId]">) {
  await requireUser();
  const { modId } = await params;
  const mod = (await loadCustomMods()).find((m) => m.data.modId === modId);
  if (!mod) notFound();
  const t = await getT();
  const storage = await getStorage();
  const [entries, metas] = await Promise.all([
    listEntries(storage, modId),
    loadLibraryMetas(storage),
  ]);
  const summaries: EntrySummary[] = entries.map((e) => ({
    id: e.data.id,
    name: e.data.name,
    type: e.data.type,
  }));
  const usersByType: Record<string, EntrySummary[]> = {};
  for (const { data } of entries) {
    for (const typeId of usedRecipeTypes(data)) {
      (usersByType[typeId] ??= []).push({
        id: data.id,
        name: data.name,
        type: data.type,
      });
    }
  }
  const library = [...metas.values()]
    .map((m) => ({
      id: m.modId,
      name: m.name,
      incompatibility: incompatibilityOf(m),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">{mod.data.name}</h1>
        <p className="font-mono text-sm text-muted">
          {t("projects.idValue", { id: modId })}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("designer.entriesTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          {ENTRY_TYPES.map((type) => (
            <Link
              key={type}
              href={`/designer/${modId}/entries/new?type=${type}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text"
            >
              <Plus className="size-4" aria-hidden />
              {t("designer.newEntry", { type: t(`entryTypes.${type}`) })}
            </Link>
          ))}
        </div>
        {entries.length === 0 ? (
          <p className="text-muted">{t("designer.noEntries")}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {ENTRY_TYPES.map((type) => {
              const ofType = entries.filter((e) => e.data.type === type);
              if (ofType.length === 0) return null;
              return (
                <div key={type} className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium text-muted">
                    {t(`entryTypeGroups.${type}`)}
                  </h3>
                  <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
                    {ofType.map(({ data }) => (
                      <li key={data.id}>
                        <Link
                          href={`/designer/${modId}/entries/${data.id.slice(modId.length + 1)}`}
                          className="flex min-h-11 items-center gap-3 px-3 py-2 hover:bg-accent/13"
                        >
                          <ItemIcon
                            icon={
                              data.icon
                                ? { kind: "icon", path: entryIconPath(data.id) }
                                : null
                            }
                            size={32}
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="font-medium">{data.name}</span>
                            <span className="truncate font-mono text-xs text-muted">
                              {data.id}
                            </span>
                          </span>
                          {/* The tint sits on its own surface base, also when the row is hovered (ADR 0011). */}
                          <span className="rounded-full bg-surface">
                            <span
                              className={`block rounded-full px-2 text-xs text-text ${STATUS_TINT[data.status]}`}
                            >
                              {t(`statuses.${data.status}`)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ModDependencies
          key={`deps-${mod.sha}`}
          modId={modId}
          sha={mod.sha}
          dependencies={mod.data.dependencies}
          library={library}
        />
        <RecipeTypesSection
          key={`types-${mod.sha}`}
          modId={modId}
          sha={mod.sha}
          recipeTypes={mod.data.recipeTypes}
          machines={summaries.filter(
            (s) => s.type === "block" || s.type === "multiblock",
          )}
          usersByType={usersByType}
        />
      </div>
    </div>
  );
}
