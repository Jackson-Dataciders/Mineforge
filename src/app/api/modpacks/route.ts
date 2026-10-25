import { z } from "zod";
import { projectNameSchema } from "@/domain/custom-mod";
import { getStorage } from "@/storage";
import { createModpack, listModpacks } from "@/storage/modpacks";
import { apiRoute, readJson } from "../_lib/route";

export const GET = apiRoute(async () => {
  return Response.json(await listModpacks(await getStorage()));
});

const createBody = z.object({ id: z.string(), name: projectNameSchema });

export const POST = apiRoute(async (request) => {
  const body = createBody.parse(await readJson(request));
  const created = await createModpack(await getStorage(), body);
  return Response.json(created, { status: 201 });
});
