import { redirect } from "next/navigation";
import { EmptyProjectState } from "@/components/shell/empty-state";
import { requireUser } from "@/server/session";
import { loadModpacks } from "@/storage";

/** Opens the first modpack, or shows the empty state. */
export default async function ModpacksPage() {
  await requireUser();
  const [first] = await loadModpacks();
  if (first) redirect(`/modpacks/${first.data.id}`);
  return <EmptyProjectState view="modpacks" />;
}
