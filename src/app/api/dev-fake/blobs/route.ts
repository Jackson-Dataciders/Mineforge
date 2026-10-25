import { z } from "zod";
import { isDevFakeMode } from "@/server/dev-fake";
import { devMemoryBackend } from "@/storage/dev-seed";
import { apiRoute, readJson } from "../../_lib/route";

const body = z.object({
  content: z.string(),
  encoding: z.literal("base64"),
});

/**
 * Dev fake mode only (ADR 0014): stands in for GitHub's `POST git/blobs`
 * during jar uploads, storing the blob in memory. 404 everywhere else.
 */
export const POST = apiRoute(async (request) => {
  if (!isDevFakeMode()) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }
  const { content } = body.parse(await readJson(request));
  const sha = devMemoryBackend().storeBlob(
    new Uint8Array(Buffer.from(content, "base64")),
  );
  return Response.json({ sha }, { status: 201 });
});
