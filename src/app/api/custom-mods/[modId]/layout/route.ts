import { z } from "zod";
import { MAX_LAYOUT_NODES } from "@/domain/mind-map";
import { getStorage } from "@/storage";
import { saveLayout } from "@/storage/layout";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

const body = z.object({
  positions: z
    .record(
      z.string().min(1).max(300),
      z.object({ x: z.number().finite(), y: z.number().finite() }),
    )
    .refine((p) => Object.keys(p).length <= MAX_LAYOUT_NODES),
  /** SHA of `layout.json` as last seen; `null` if it didn't exist. */
  sha: z.string().min(1).nullable(),
});

/** Saves the mind map's node positions (spec 06). */
export const PUT = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { positions, sha } = body.parse(await readJson(request));
  return Response.json(
    await saveLayout(await getStorage(), modId, positions, sha),
  );
});
