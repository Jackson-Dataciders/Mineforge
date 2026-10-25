import { z } from "zod";
import { getStorage } from "@/storage";
import { commitUploadedJars } from "@/storage/jars";
import { apiRoute, readJson } from "../_lib/route";

const body = z.object({
  files: z
    .array(z.object({ name: z.string(), sha: z.string() }))
    .min(1)
    .max(50),
});

/** Commits jars whose blobs the browser created to `jars/mods/`, in one commit. */
export const POST = apiRoute(async (request) => {
  const { files } = body.parse(await readJson(request));
  const result = await commitUploadedJars(await getStorage(), files);
  return Response.json(result, { status: 201 });
});
