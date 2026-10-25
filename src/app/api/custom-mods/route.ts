import { z } from "zod";
import { projectNameSchema } from "@/domain/custom-mod";
import { getStorage } from "@/storage";
import { createCustomMod, listCustomMods } from "@/storage/custom-mods";
import { apiRoute, readJson } from "../_lib/route";

export const GET = apiRoute(async () => {
  return Response.json(await listCustomMods(await getStorage()));
});

const createBody = z.object({ modId: z.string(), name: projectNameSchema });

export const POST = apiRoute(async (request) => {
  const body = createBody.parse(await readJson(request));
  const created = await createCustomMod(await getStorage(), body);
  return Response.json(created, { status: 201 });
});
