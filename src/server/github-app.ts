import "server-only";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { cache } from "react";
import { githubEnv } from "./env";

/**
 * Creates a fresh installation token for the GitHub App, limited to the data
 * repo with contents write only (ADR 0003). Tokens expire after at most one
 * hour and are never cached across requests.
 */
export async function createInstallationToken(): Promise<{
  token: string;
  expiresAt: string;
}> {
  const env = githubEnv();
  const appAuth = createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });
  const result = await appAuth({
    type: "installation",
    installationId: env.GITHUB_APP_INSTALLATION_ID,
    repositoryNames: [env.GITHUB_REPO_NAME],
    permissions: { contents: "write" },
    refresh: true,
  });
  return { token: result.token, expiresAt: result.expiresAt };
}

/** Octokit for the data repo, with one new installation token per request. */
export const getRepoOctokit = cache(async () => {
  const { token } = await createInstallationToken();
  return new Octokit({ auth: token, userAgent: "mineforge" });
});
