import type { ProjectPhase } from "@/domain/custom-mod";
import { designerTasksSchema, pruneGenerated } from "@/domain/designer-tasks";
import type { EntrySummary } from "@/domain/entry";
import { stableStringify } from "@/lib/stable-json";
import { encodeDocument, readDocument } from "./documents";
import { paths } from "./paths";
import type { FileChange, StorageBackend } from "./types";

/**
 * When the phase or an entry changes, in-progress state of generated tasks
 * that are no longer open is dropped in the same commit (ADR 0022), so a
 * task that becomes open again later starts in To do. Returns the
 * `tasks.json` change (`null` if nothing changes) and its SHA (`null` if the
 * file is missing). Callers always expect that SHA, so a task write between
 * this read and their commit becomes a conflict.
 */
export async function pruneTasksChange(
  storage: StorageBackend,
  modId: string,
  entries: readonly EntrySummary[],
  phase: ProjectPhase,
): Promise<{ path: string; change: FileChange | null; sha: string | null }> {
  const path = paths.customModTasksFile(modId);
  const tasks = await readDocument(storage, path, designerTasksSchema);
  if (!tasks) return { path, change: null, sha: null };
  const pruned = pruneGenerated(tasks.data, entries, phase);
  if (stableStringify(pruned) === stableStringify(tasks.data)) {
    return { path, change: null, sha: tasks.sha };
  }
  return {
    path,
    change: { path, content: encodeDocument(designerTasksSchema, pruned) },
    sha: tasks.sha,
  };
}
