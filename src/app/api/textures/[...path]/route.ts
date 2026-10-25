import { apiRoute } from "../../_lib/route";
import { assetResponse } from "../../_lib/asset-response";

/** `/api/textures/<namespace>/...png` → `assets/textures/<namespace>/...png`. */
export const GET = apiRoute(
  async (request, { params }: { params: Promise<{ path: string[] }> }) =>
    assetResponse(request, "texture", (await params).path),
);
