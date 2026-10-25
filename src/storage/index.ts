import "server-only";
import { cache } from "react";
import { isDevFakeMode } from "@/server/dev-fake";
import { githubEnv } from "@/server/env";
import { getRepoOctokit } from "@/server/github-app";
import { listCustomMods } from "./custom-mods";
import { devMemoryBackend } from "./dev-seed";
import { GitHubBackend } from "./github-backend";
import { listModpacks } from "./modpacks";
import { createOctokitApi } from "./octokit-api";
import type { StorageBackend } from "./types";

/** The storage backend for this request: GitHub, or in-memory in dev fake mode. */
export const getStorage = cache(async (): Promise<StorageBackend> => {
  if (isDevFakeMode()) return devMemoryBackend();
  const env = githubEnv();
  const octokit = await getRepoOctokit();
  return new GitHubBackend(
    createOctokitApi(octokit, env.GITHUB_REPO_OWNER, env.GITHUB_REPO_NAME),
    env.GITHUB_DATA_BRANCH,
  );
});

export * from "./types";
export type { Versioned } from "./documents";

/** Request-scoped cached loaders for server components (layout and page share one read). */
export const loadCustomMods = cache(async () =>
  listCustomMods(await getStorage()),
);
export const loadModpacks = cache(async () => listModpacks(await getStorage()));
