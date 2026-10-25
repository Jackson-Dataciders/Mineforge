import { recipesProducing } from "@/domain/item-sources";
import { resourceIdSchema } from "@/domain/library";
import { getStorage, ValidationError } from "@/storage";
import { loadPackItemSources } from "@/storage/pack-items";
import { apiRoute } from "../../../_lib/route";

type Context = { params: Promise<{ packId: string }> };

/** `?item=<id>`: vanilla and pack-library recipes whose outputs contain the item. */
export const GET = apiRoute(async (request, { params }: Context) => {
  const { packId } = await params;
  const item = new URL(request.url).searchParams.get("item") ?? "";
  if (!resourceIdSchema.safeParse(item).success) {
    throw new ValidationError("invalidInput");
  }
  const { sources } = await loadPackItemSources(await getStorage(), packId);
  return Response.json(recipesProducing(sources, item));
});
