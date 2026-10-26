import { getStorage } from "@/storage";
import {
  loadDesignerItemSources,
  searchSetOfItemSet,
} from "@/storage/pack-items";
import { apiRoute } from "../../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

/** Items and tags the designer's item search offers for this custom mod. */
export const GET = apiRoute(async (_request, { params }: Context) => {
  const { modId } = await params;
  const set = await loadDesignerItemSources(await getStorage(), modId);
  return Response.json(searchSetOfItemSet(set), {
    headers: { "Cache-Control": "private, no-cache" },
  });
});
