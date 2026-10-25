import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { loadCustomMods } from "@/storage";

export default async function CustomModPage({
  params,
}: PageProps<"/designer/[modId]">) {
  await requireUser();
  const { modId } = await params;
  const mod = (await loadCustomMods()).find((m) => m.data.modId === modId);
  if (!mod) notFound();
  const t = await getT();
  return (
    <section>
      <h1 className="text-xl font-semibold">{mod.data.name}</h1>
      <p className="font-mono text-sm text-muted">
        {t("projects.idValue", { id: mod.data.modId })}
      </p>
    </section>
  );
}
