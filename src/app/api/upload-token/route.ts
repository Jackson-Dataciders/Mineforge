import { isDevFakeMode } from "@/server/dev-fake";
import { githubEnv } from "@/server/env";
import { createInstallationToken } from "@/server/github-app";
import { apiRoute } from "../_lib/route";

/** What the browser needs to create jar blobs directly on GitHub (ADR 0005). */
export type UploadTarget = {
  token: string;
  expiresAt: string;
  /** `POST` endpoint for `{ content, encoding: "base64" }` → `{ sha }`. */
  blobsUrl: string;
};

/**
 * Issues a fresh installation token limited to this repo with contents write
 * (ADR 0005). The only route that hands a token to the browser.
 */
export const POST = apiRoute(async () => {
  let target: UploadTarget;
  if (isDevFakeMode()) {
    target = {
      token: "dev-fake",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      blobsUrl: "/api/dev-fake/blobs",
    };
  } else {
    const env = githubEnv();
    const { token, expiresAt } = await createInstallationToken();
    target = {
      token,
      expiresAt,
      blobsUrl: `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_REPO_OWNER)}/${encodeURIComponent(env.GITHUB_REPO_NAME)}/git/blobs`,
    };
  }
  return Response.json(target, {
    headers: { "Cache-Control": "no-store" },
  });
});
