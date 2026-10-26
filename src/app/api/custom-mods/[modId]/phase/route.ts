import { z } from "zod";
import { projectPhaseSchema } from "@/domain/custom-mod";
import { getStorage } from "@/storage";
import { setCustomModPhase } from "@/storage/custom-mods";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ modId: string }> };

const body = z.object({ phase: projectPhaseSchema, sha: z.string().min(1) });

/** Sets the custom mod's current phase (spec 05). */
export const PUT = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { phase, sha } = body.parse(await readJson(request));
  return Response.json(
    await setCustomModPhase(await getStorage(), modId, phase, sha),
  );
});
