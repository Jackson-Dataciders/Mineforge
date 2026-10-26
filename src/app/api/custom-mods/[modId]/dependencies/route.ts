import { z } from "zod";
import { getStorage } from "@/storage";
import { setCustomModDependencies } from "@/storage/custom-mods";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

const body = z.object({
  dependencies: z.array(z.string()).max(500),
  sha: z.string().min(1),
});

/** Sets the library mods the custom mod depends on. */
export const PUT = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { dependencies, sha } = body.parse(await readJson(request));
  return Response.json(
    await setCustomModDependencies(
      await getStorage(),
      modId,
      dependencies,
      sha,
    ),
  );
});
