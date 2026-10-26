import { notFound } from "next/navigation";
import { EntryEditor } from "@/components/designer/entry-editor";
import { referencesEntry, summarizeEntry } from "@/domain/entry";
import { requireUser } from "@/server/session";
import { getStorage, loadCustomMods } from "@/storage";
import { getEntry, listEntries } from "@/storage/entries";

/** The form of an existing entry (spec 04). */
export default async function EntryPage({
  params,
}: PageProps<"/designer/[modId]/entries/[entryPath]">) {
  await requireUser();
  const { modId, entryPath } = await params;
  const mod = (await loadCustomMods()).find((m) => m.data.modId === modId);
  if (!mod) notFound();
  const storage = await getStorage();
  const [entry, entries] = await Promise.all([
    getEntry(storage, modId, entryPath),
    listEntries(storage, modId),
  ]);
  if (!entry) notFound();
  return (
    <EntryEditor
      key={entry.sha}
      modId={modId}
      modName={mod.data.name}
      mode={{ kind: "edit", entry: entry.data, sha: entry.sha }}
      entries={entries.map((e) => summarizeEntry(e.data))}
      recipeTypes={mod.data.recipeTypes}
      referencedBy={entries
        .filter((e) => referencesEntry(e.data, entry.data.id))
        .map((e) => summarizeEntry(e.data))}
    />
  );
}
