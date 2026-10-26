import { z } from "zod";
import { getStorage } from "@/storage";
import { deleteEntry, updateEntry } from "@/storage/entries";
import { apiRoute, readJson } from "../../../../_lib/route";
import { decodeIcon, iconBodySchema } from "../icon-body";

type Context = { params: Promise<{ modId: string; entryPath: string }> };

const updateBody = z.object({
  entry: z.unknown(),
  sha: z.string().min(1),
  icon: iconBodySchema,
});

/** Saves an entry (and its icon change) in one commit. */
export const PUT = apiRoute(async (request, { params }: Context) => {
  const { modId, entryPath } = await params;
  const { entry, sha, icon } = updateBody.parse(await readJson(request));
  return Response.json(
    await updateEntry(
      await getStorage(),
      modId,
      entryPath,
      entry,
      sha,
      decodeIcon(icon),
    ),
  );
});

const deleteBody = z.object({ sha: z.string().min(1) });

/** Deletes the entry, its icon and relations to it, in one commit. */
export const DELETE = apiRoute(async (request, { params }: Context) => {
  const { modId, entryPath } = await params;
  const { sha } = deleteBody.parse(await readJson(request));
  await deleteEntry(await getStorage(), modId, entryPath, sha);
  return Response.json({ deleted: `${modId}:${entryPath}` });
});
