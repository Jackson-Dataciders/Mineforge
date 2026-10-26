import { z } from "zod";
import { taskColumnSchema } from "@/domain/designer-tasks";
import { taskIdSchema } from "@/domain/pack-tasks";
import { getStorage } from "@/storage";
import { moveGeneratedTask, moveManualTask } from "@/storage/designer-tasks";
import { apiRoute, readJson } from "../../../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

const sha = z.string().min(1).nullable();
const body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("generated"),
    key: z.string().min(1).max(200),
    column: taskColumnSchema,
    sha,
  }),
  z.object({
    kind: z.literal("manual"),
    id: taskIdSchema,
    column: taskColumnSchema,
    sha,
  }),
]);

/**
 * Moves a task to another column. For generated tasks, Done completes the
 * task and leaving Done reopens it, changing the entry's status (spec 05).
 */
export const POST = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const input = body.parse(await readJson(request));
  const storage = await getStorage();
  if (input.kind === "generated") {
    return Response.json(
      await moveGeneratedTask(
        storage,
        modId,
        input.key,
        input.column,
        input.sha,
      ),
    );
  }
  return Response.json({
    tasks: await moveManualTask(
      storage,
      modId,
      input.id,
      input.column,
      input.sha,
    ),
    entry: null,
  });
});
