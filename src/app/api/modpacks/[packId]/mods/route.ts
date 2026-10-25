import { z } from "zod";
import { getStorage } from "@/storage";
import { setModpackMods } from "@/storage/modpacks";
import { apiRoute, readJson } from "../../../_lib/route";

type Context = { params: Promise<{ packId: string }> };

const body = z.object({
  libraryModIds: z.array(z.string()).max(1000),
  customModIds: z.array(z.string()).max(1000),
  sha: z.string().min(1),
});

/** Replaces the pack's library mod and custom mod references. */
export const PUT = apiRoute(async (request, { params }: Context) => {
  const { packId } = await params;
  const { sha, ...mods } = body.parse(await readJson(request));
  return Response.json(
    await setModpackMods(await getStorage(), packId, mods, sha),
  );
});
