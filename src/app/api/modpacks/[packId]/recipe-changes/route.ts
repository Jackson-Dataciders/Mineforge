import { z } from "zod";
import { resourceIdSchema } from "@/domain/library";
import { recipeChangeEditSchema } from "@/domain/recipe-change";
import { getStorage, ValidationError } from "@/storage";
import { loadPackItemSources } from "@/storage/pack-items";
import { createRecipeChange } from "@/storage/recipe-changes";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ packId: string }> };

const body = z.object({
  item: resourceIdSchema,
  change: recipeChangeEditSchema,
});

/**
 * Creates a recipe change and its KubeJS task in one commit. The item must
 * be in the pack's item set; its English name is taken from there.
 */
export const POST = apiRoute(async (request, { params }: Context) => {
  const { packId } = await params;
  const { item, change } = body.parse(await readJson(request));
  const storage = await getStorage();
  const { sources } = await loadPackItemSources(storage, packId);
  const found = sources
    .flatMap((s) => s.items)
    .find((candidate) => candidate.id === item);
  if (!found) throw new ValidationError("itemNotInPack");

  const created = await createRecipeChange(storage, packId, {
    ...change,
    item,
    itemName: found.name,
  });
  return Response.json(created, { status: 201 });
});
