import { apiRoute } from "../../_lib/route";
import { assetResponse } from "../../_lib/asset-response";

/** `/api/icons/<custom-modid>/<entry-id>.png` → `assets/icons/...`. */
export const GET = apiRoute(
  async (request, { params }: { params: Promise<{ path: string[] }> }) =>
    assetResponse(request, "icon", (await params).path),
);
