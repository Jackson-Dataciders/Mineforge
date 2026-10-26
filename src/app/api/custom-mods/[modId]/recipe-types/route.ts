import { z } from "zod";
import { getStorage } from "@/storage";
import { createRecipeType } from "@/storage/custom-mods";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

const body = z.object({ type: z.unknown(), sha: z.string().min(1) });

/** Adds a custom machine recipe type to `mod.json`. */
export const POST = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { type, sha } = body.parse(await readJson(request));
  return Response.json(
    await createRecipeType(await getStorage(), modId, type, sha),
    { status: 201 },
  );
});
