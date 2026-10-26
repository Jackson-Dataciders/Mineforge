import { z } from "zod";
import { getStorage } from "@/storage";
import { deleteRecipeType, updateRecipeType } from "@/storage/custom-mods";
import { apiRoute, readJson } from "../../../../_lib/route";

type Context = { params: Promise<{ modId: string; typeId: string }> };

const updateBody = z.object({ type: z.unknown(), sha: z.string().min(1) });

export const PUT = apiRoute(async (request, { params }: Context) => {
  const { modId, typeId } = await params;
  const { type, sha } = updateBody.parse(await readJson(request));
  return Response.json(
    await updateRecipeType(await getStorage(), modId, typeId, type, sha),
  );
});

const deleteBody = z.object({ sha: z.string().min(1) });

export const DELETE = apiRoute(async (request, { params }: Context) => {
  const { modId, typeId } = await params;
  const { sha } = deleteBody.parse(await readJson(request));
  return Response.json(
    await deleteRecipeType(await getStorage(), modId, typeId, sha),
  );
});
