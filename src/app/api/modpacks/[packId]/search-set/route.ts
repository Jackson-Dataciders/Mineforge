import { getStorage } from "@/storage";
import { loadPackItemSources, searchSetOfItemSet } from "@/storage/pack-items";
import { apiRoute } from "../../../_lib/route";

type Context = { params: Promise<{ packId: string }> };

/** Items and tags the pack's item search modal offers. */
export const GET = apiRoute(async (_request, { params }: Context) => {
  const { packId } = await params;
  const set = await loadPackItemSources(await getStorage(), packId);
  return Response.json(searchSetOfItemSet(set), {
    headers: { "Cache-Control": "private, no-cache" },
  });
});
