import {
  buildMindMap,
  EMPTY_LAYOUT,
  layoutSchema,
  mindMapNodeIds,
  sanitizePositions,
  type Layout,
  type Position,
} from "@/domain/mind-map";
import { isModId } from "@/domain/ids";
import { getCustomMod } from "./custom-mods";
import { encodeDocument, readDocument } from "./documents";
import { listEntries } from "./entries";
import { gitBlobSha } from "./git-sha";
import { paths } from "./paths";
import { NotFoundError, type StorageBackend } from "./types";

/**
 * Mind map node positions (spec 06, ADR 0023). Saved as a whole with the
 * `layout.json` SHA the client last saw; positions of IDs that are no
 * longer nodes are dropped, and a save that changes nothing isn't written.
 */

/** `layout.json` with its SHA; `sha: null` means the file doesn't exist yet. */
export type VersionedLayout = { data: Layout; sha: string | null };

export async function readLayout(
  storage: StorageBackend,
  modId: string,
): Promise<VersionedLayout> {
  const doc = isModId(modId)
    ? await readDocument(
        storage,
        paths.customModLayoutFile(modId),
        layoutSchema,
      )
    : null;
  return doc ?? { data: EMPTY_LAYOUT, sha: null };
}

export async function saveLayout(
  storage: StorageBackend,
  modId: string,
  positions: Readonly<Record<string, Position>>,
  expectedSha: string | null,
): Promise<VersionedLayout> {
  const mod = await getCustomMod(storage, modId);
  if (!mod) throw new NotFoundError(`custom mod ${modId}`);
  const entries = await listEntries(storage, modId);
  const map = buildMindMap(
    entries.map((e) => e.data),
    mod.data.recipeTypes,
  );
  const data = layoutSchema.parse({
    positions: sanitizePositions(positions, mindMapNodeIds(map)),
  });
  const content = encodeDocument(layoutSchema, data);
  const current = await storage.readFile(paths.customModLayoutFile(modId));
  // Nothing changed: no commit.
  if (
    current &&
    current.sha === expectedSha &&
    gitBlobSha(content) === current.sha
  ) {
    return { data, sha: current.sha };
  }
  const { sha } = await storage.writeFile(
    paths.customModLayoutFile(modId),
    content,
    expectedSha,
    `data: update layout of custom mod ${modId}`,
  );
  return { data, sha };
}
