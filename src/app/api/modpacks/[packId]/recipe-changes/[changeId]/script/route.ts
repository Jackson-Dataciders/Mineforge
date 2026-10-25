import { generateKubeJsScript, scriptFileName } from "@/domain/kubejs";
import { getStorage, NotFoundError } from "@/storage";
import { getModpack } from "@/storage/modpacks";
import { getRecipeChange } from "@/storage/recipe-changes";
import { apiRoute } from "../../../../../_lib/route";

type Context = { params: Promise<{ packId: string; changeId: string }> };

/** Downloads the KubeJS server script of one recipe change (ADR 0018). */
export const GET = apiRoute(async (_request, { params }: Context) => {
  const { packId, changeId } = await params;
  const storage = await getStorage();
  const [pack, change] = await Promise.all([
    getModpack(storage, packId),
    getRecipeChange(storage, packId, changeId),
  ]);
  if (!pack || !change) throw new NotFoundError(`recipe change ${changeId}`);
  // Both IDs match strict patterns, so the file name needs no escaping.
  return new Response(generateKubeJsScript(packId, change.data), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Content-Disposition": `attachment; filename="${scriptFileName(packId, changeId)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
