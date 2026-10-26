import { z } from "zod";
import { projectPhaseSchema } from "@/domain/custom-mod";
import { entryIdSchema } from "@/domain/entry-id";
import { taskTitleSchema } from "@/domain/pack-tasks";
import { getStorage } from "@/storage";
import { createManualTask } from "@/storage/designer-tasks";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

const body = z.object({
  title: taskTitleSchema,
  entryId: entryIdSchema.nullable(),
  phase: projectPhaseSchema.nullable(),
  /** SHA of `tasks.json` as last seen; `null` if it didn't exist. */
  sha: z.string().min(1).nullable(),
});

/** Adds a manual task to the custom mod's taskboard. */
export const POST = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { sha, ...input } = body.parse(await readJson(request));
  return Response.json(
    await createManualTask(await getStorage(), modId, input, sha),
    { status: 201 },
  );
});
