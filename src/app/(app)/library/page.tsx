import { CircleCheck, Hourglass, TriangleAlert } from "lucide-react";
import { ItemIcon } from "@/components/items/item-icon";
import { CompatBadge } from "@/components/library/compat-badge";
import { JarUpload } from "@/components/library/jar-upload";
import { targetCompatibility } from "@/domain/compatibility";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { getStorage } from "@/storage";
import { loadLibraryOverview } from "@/storage/library";

/** The global mod library (spec 03): imported mods, pending jars, jar upload. */
export default async function LibraryPage() {
  await requireUser();
  const t = await getT();
  const overview = await loadLibraryOverview(await getStorage());
  const count = (
    key: "items" | "inferredItems" | "inferredRecipes",
    n: number,
  ) => (n === 1 ? t(`library.${key}One`) : t(`library.${key}`, { count: n }));

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("library.title")}</h1>
        <JarUpload existingNames={overview.jarNames} />
      </header>

      <p className="flex items-start gap-2 text-sm text-muted">
        {overview.hasVanillaData ? (
          <CircleCheck className="size-5 shrink-0 text-ok" aria-hidden />
        ) : (
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
        )}
        {overview.hasVanillaData
          ? t("library.vanillaImported")
          : t("library.vanillaMissing")}
      </p>

      {overview.pendingJars.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t("library.pendingTitle")}</h2>
          <p className="text-sm text-muted">{t("library.pendingHint")}</p>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {overview.pendingJars.map((name) => (
              <li
                key={name}
                className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
              >
                <Hourglass className="size-4 text-muted" aria-hidden />
                <span className="font-mono text-sm break-all">{name}</span>
                <span className="rounded-full bg-muted/13 px-2 text-xs text-text">
                  {t("library.pendingBadge")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        {overview.mods.length === 0 ? (
          <p className="text-muted">{t("library.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {overview.mods.map(
              ({ meta, itemCount, inferredItemCount, inferredRecipeCount }) => {
                const compat = targetCompatibility(meta);
                return (
                  <li key={meta.modId} className="flex items-start gap-3 p-3">
                    <ItemIcon
                      icon={
                        meta.logo ? { kind: "texture", path: meta.logo } : null
                      }
                      size={40}
                      smooth
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{meta.name}</span>
                        <span className="font-mono text-xs text-muted">
                          {meta.modId}
                        </span>
                        {!compat.compatible && (
                          <CompatBadge
                            info={
                              compat.reason === "loader"
                                ? { reason: "loader", loader: meta.loader }
                                : {
                                    reason: "version",
                                    range: meta.minecraftVersionRange ?? "",
                                  }
                            }
                          />
                        )}
                      </div>
                      <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                        <span>
                          {t("library.version", { version: meta.version })}
                        </span>
                        <span>{count("items", itemCount)}</span>
                        <span>{count("inferredItems", inferredItemCount)}</span>
                        <span>
                          {count("inferredRecipes", inferredRecipeCount)}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
