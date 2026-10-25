import { z } from "zod";
import { getStorage } from "@/storage";
import { deletePackTask, setPackTaskDone } from "@/storage/pack-tasks";
import { apiRoute, readJson } from "../../../../_lib/route";

type Context = { params: Promise<{ packId: string; taskId: string }> };

const sha = z.string().min(1).nullable();

export const PATCH = apiRoute(async (request, { params }: Context) => {
  const { packId, taskId } = await params;
  const body = z
    .object({ done: z.boolean(), sha })
    .parse(await readJson(request));
  return Response.json(
    await setPackTaskDone(
      await getStorage(),
      packId,
      taskId,
      body.done,
      body.sha,
    ),
  );
});

export const DELETE = apiRoute(async (request, { params }: Context) => {
  const { packId, taskId } = await params;
  const body = z.object({ sha }).parse(await readJson(request));
  return Response.json(
    await deletePackTask(await getStorage(), packId, taskId, body.sha),
  );
});
