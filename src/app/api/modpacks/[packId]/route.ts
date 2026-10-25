import { z } from "zod";
import { projectNameSchema } from "@/domain/custom-mod";
import { getStorage, NotFoundError } from "@/storage";
import { deleteModpack, getModpack, renameModpack } from "@/storage/modpacks";
import { apiRoute, readJson } from "../../_lib/route";

type Context = { params: Promise<{ packId: string }> };

export const GET = apiRoute(async (_request, { params }: Context) => {
  const { packId } = await params;
  const pack = await getModpack(await getStorage(), packId);
  if (!pack) throw new NotFoundError(`modpack ${packId}`);
  return Response.json(pack);
});

const renameBody = z.object({
  name: projectNameSchema,
  sha: z.string().min(1),
});

export const PATCH = apiRoute(async (request, { params }: Context) => {
  const { packId } = await params;
  const { name, sha } = renameBody.parse(await readJson(request));
  return Response.json(
    await renameModpack(await getStorage(), packId, name, sha),
  );
});

const deleteBody = z.object({ sha: z.string().min(1) });

export const DELETE = apiRoute(async (request, { params }: Context) => {
  const { packId } = await params;
  const { sha } = deleteBody.parse(await readJson(request));
  await deleteModpack(await getStorage(), packId, sha);
  return Response.json({ deleted: packId });
});
