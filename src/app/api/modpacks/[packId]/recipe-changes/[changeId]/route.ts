import { z } from "zod";
import { recipeChangeEditSchema } from "@/domain/recipe-change";
import { getStorage, NotFoundError } from "@/storage";
import {
  deleteRecipeChange,
  getRecipeChange,
  updateRecipeChange,
} from "@/storage/recipe-changes";
import { apiRoute, readJson } from "../../../../_lib/route";

type Context = { params: Promise<{ packId: string; changeId: string }> };

const updateBody = z.object({
  change: recipeChangeEditSchema,
  sha: z.string().min(1),
});

/** Saves an edited change and unchecks its KubeJS task, in one commit. */
export const PUT = apiRoute(async (request, { params }: Context) => {
  const { packId, changeId } = await params;
  const { change, sha } = updateBody.parse(await readJson(request));
  const storage = await getStorage();
  const current = await getRecipeChange(storage, packId, changeId);
  if (!current) throw new NotFoundError(`recipe change ${changeId}`);
  return Response.json(
    await updateRecipeChange(
      storage,
      packId,
      changeId,
      { ...change, item: current.data.item, itemName: current.data.itemName },
      sha,
    ),
  );
});

const deleteBody = z.object({ sha: z.string().min(1) });

/** Deletes the change and its KubeJS task, in one commit. */
export const DELETE = apiRoute(async (request, { params }: Context) => {
  const { packId, changeId } = await params;
  const { sha } = deleteBody.parse(await readJson(request));
  await deleteRecipeChange(await getStorage(), packId, changeId, sha);
  return Response.json({ deleted: changeId });
});
