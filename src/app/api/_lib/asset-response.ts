import { getStorage } from "@/storage";
import { readAsset, resolveAssetPath, type AssetKind } from "@/storage/assets";

/** Extracted textures rarely change; drawn icons change on every save. */
const CACHE_CONTROL: Record<AssetKind, string> = {
  texture: "private, max-age=3600, stale-while-revalidate=86400",
  icon: "private, no-cache",
};

/**
 * Serves a PNG from `assets/` through the storage layer, never from public/
 * (ADR 0004). ETag is the git blob SHA.
 */
export async function assetResponse(
  request: Request,
  kind: AssetKind,
  segments: string[],
): Promise<Response> {
  const path = resolveAssetPath(kind, segments);
  if (!path) return Response.json({ error: "notFound" }, { status: 404 });
  const file = await readAsset(await getStorage(), path);
  if (!file) return Response.json({ error: "notFound" }, { status: 404 });

  const etag = `"${file.sha}"`;
  const headers = {
    "Cache-Control": CACHE_CONTROL[kind],
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(Buffer.from(file.content), {
    headers: { ...headers, "Content-Type": "image/png" },
  });
}
