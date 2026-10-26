import { notFound } from "next/navigation";
import { EntryEditor } from "@/components/designer/entry-editor";
import { isEntryType, summarizeEntry } from "@/domain/entry";
import { requireUser } from "@/server/session";
import { getStorage, loadCustomMods } from "@/storage";
import { listEntries } from "@/storage/entries";

/** `?type=<entry type>`: the form for a new entry (spec 04). */
export default async function NewEntryPage({
  params,
  searchParams,
}: PageProps<"/designer/[modId]/entries/new">) {
  await requireUser();
  const { modId } = await params;
  const { type } = await searchParams;
  const mod = (await loadCustomMods()).find((m) => m.data.modId === modId);
  if (!mod || typeof type !== "string" || !isEntryType(type)) notFound();
  const entries = await listEntries(await getStorage(), modId);
  return (
    <EntryEditor
      modId={modId}
      modName={mod.data.name}
      mode={{ kind: "new", type }}
      entries={entries.map((e) => summarizeEntry(e.data))}
      recipeTypes={mod.data.recipeTypes}
      referencedBy={[]}
    />
  );
}
