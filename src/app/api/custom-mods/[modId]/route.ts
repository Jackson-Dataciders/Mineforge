import { z } from "zod";
import { projectNameSchema } from "@/domain/custom-mod";
import { getStorage, NotFoundError } from "@/storage";
import {
  deleteCustomMod,
  getCustomMod,
  renameCustomMod,
} from "@/storage/custom-mods";
import { apiRoute, readJson } from "../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

export const GET = apiRoute(async (_request, { params }: Context) => {
  const { modId } = await params;
  const mod = await getCustomMod(await getStorage(), modId);
  if (!mod) throw new NotFoundError(`custom mod ${modId}`);
  return Response.json(mod);
});

const renameBody = z.object({
  name: projectNameSchema,
  sha: z.string().min(1),
});

export const PATCH = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { name, sha } = renameBody.parse(await readJson(request));
  return Response.json(
    await renameCustomMod(await getStorage(), modId, name, sha),
  );
});

const deleteBody = z.object({ sha: z.string().min(1) });

export const DELETE = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { sha } = deleteBody.parse(await readJson(request));
  await deleteCustomMod(await getStorage(), modId, sha);
  return Response.json({ deleted: modId });
});
