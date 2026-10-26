import { z } from "zod";
import { getStorage } from "@/storage";
import { deleteManualTask } from "@/storage/designer-tasks";
import { apiRoute, readJson } from "../../../../_lib/route";

type Context = { params: Promise<{ modId: string; taskId: string }> };

const body = z.object({ sha: z.string().min(1).nullable() });

/** Deletes a manual task; generated tasks can't be deleted. */
export const DELETE = apiRoute(async (request, { params }: Context) => {
  const { modId, taskId } = await params;
  const { sha } = body.parse(await readJson(request));
  return Response.json(
    await deleteManualTask(await getStorage(), modId, taskId, sha),
  );
});
