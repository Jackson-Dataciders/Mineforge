import { redirect } from "next/navigation";
import { EmptyProjectState } from "@/components/shell/empty-state";
import { requireUser } from "@/server/session";
import { loadCustomMods } from "@/storage";

/** Opens the first custom mod, or shows the empty state. */
export default async function DesignerPage() {
  await requireUser();
  const [first] = await loadCustomMods();
  if (first) redirect(`/designer/${first.data.modId}`);
  return <EmptyProjectState view="designer" />;
}
