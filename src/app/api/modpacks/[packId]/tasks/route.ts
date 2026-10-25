import { z } from "zod";
import { taskTitleSchema } from "@/domain/pack-tasks";
import { getStorage } from "@/storage";
import { createManualPackTask } from "@/storage/pack-tasks";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ packId: string }> };

const body = z.object({
  title: taskTitleSchema,
  /** SHA of `tasks.json` as last seen; `null` if it didn't exist. */
  sha: z.string().min(1).nullable(),
});

export const POST = apiRoute(async (request, { params }: Context) => {
  const { packId } = await params;
  const { title, sha } = body.parse(await readJson(request));
  return Response.json(
    await createManualPackTask(await getStorage(), packId, title, sha),
    { status: 201 },
  );
});
