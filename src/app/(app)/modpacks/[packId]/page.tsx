import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/session";
import { loadModpacks } from "@/storage";

export default async function ModpackPage({
  params,
}: PageProps<"/modpacks/[packId]">) {
  await requireUser();
  const { packId } = await params;
  const pack = (await loadModpacks()).find((p) => p.data.id === packId);
  if (!pack) notFound();
  const t = await getT();
  return (
    <section>
      <h1 className="text-xl font-semibold">{pack.data.name}</h1>
      <p className="font-mono text-sm text-muted">
        {t("projects.idValue", { id: pack.data.id })}
      </p>
    </section>
  );
}
