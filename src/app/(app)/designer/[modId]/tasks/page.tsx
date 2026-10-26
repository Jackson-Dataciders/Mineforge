import { notFound } from "next/navigation";
import { ModHeader } from "@/components/designer/mod-header";
import { Taskboard } from "@/components/designer/taskboard";
import { summarizeEntry } from "@/domain/entry";
import { requireUser } from "@/server/session";
import { getStorage, loadCustomMods } from "@/storage";
import { readDesignerTasks } from "@/storage/designer-tasks";
import { listEntries } from "@/storage/entries";

/** The custom mod's taskboard (spec 05). */
export default async function TaskboardPage({
  params,
}: PageProps<"/designer/[modId]/tasks">) {
  await requireUser();
  const { modId } = await params;
  const mod = (await loadCustomMods()).find((m) => m.data.modId === modId);
  if (!mod) notFound();
  const storage = await getStorage();
  const [entries, tasks] = await Promise.all([
    listEntries(storage, modId),
    readDesignerTasks(storage, modId),
  ]);
  const summaries = entries.map((e) => summarizeEntry(e.data));
  // Fresh server data (after a reload or conflict) remounts the board.
  const version = [mod.sha, tasks.sha, ...entries.map((e) => e.sha)].join("|");
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <ModHeader
        key={mod.sha}
        modId={modId}
        name={mod.data.name}
        phase={mod.data.phase}
        sha={mod.sha}
      />
      <Taskboard
        key={version}
        modId={modId}
        phase={mod.data.phase}
        initialTasks={tasks}
        initialEntries={summaries}
      />
    </div>
  );
}
