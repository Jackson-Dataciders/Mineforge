import { z } from "zod";
import { getStorage } from "@/storage";
import { createEntry } from "@/storage/entries";
import { apiRoute, readJson } from "../../../_lib/route";
import { decodeIcon, iconBodySchema } from "./icon-body";

type Context = { params: Promise<{ modId: string }> };

const body = z.object({ entry: z.unknown(), icon: iconBodySchema });

/** Creates an entry (and its icon) in one commit. */
export const POST = apiRoute(async (request, { params }: Context) => {
  const { modId } = await params;
  const { entry, icon } = body.parse(await readJson(request));
  return Response.json(
    await createEntry(await getStorage(), modId, entry, decodeIcon(icon)),
    { status: 201 },
  );
});
