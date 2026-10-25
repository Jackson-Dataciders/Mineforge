import type { Octokit } from "@octokit/rest";
import type { GitHubApi } from "./github-backend";

const toBase64 = (content: Uint8Array) =>
  Buffer.from(content).toString("base64");
const fromBase64 = (content: string) =>
  new Uint8Array(Buffer.from(content, "base64"));

function isNotFound(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: unknown }).status === 404
  );
}

/** `GitHubApi` implemented with Octokit for one repository. */
export function createOctokitApi(
  octokit: Octokit,
  owner: string,
  repo: string,
): GitHubApi {
  return {
    async getContent(path, ref) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref,
        });
        if (Array.isArray(data)) {
          return {
            type: "dir",
            entries: data
              .filter((e) => e.type === "file" || e.type === "dir")
              .map((e) => ({
                name: e.name,
                path: e.path,
                type: e.type as "file" | "dir",
                sha: e.sha,
              })),
          };
        }
        if (data.type !== "file") return null;
        const inline =
          "content" in data && data.encoding === "base64" && data.content;
        return {
          type: "file",
          sha: data.sha,
          content: inline ? fromBase64(data.content) : undefined,
        };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async getBlob(sha) {
      const { data } = await octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: sha,
      });
      return fromBase64(data.content);
    },

    async getTree(sha) {
      const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: sha,
        recursive: "true",
      });
      return {
        truncated: data.truncated,
        entries: data.tree.map((e) => ({
          path: e.path ?? "",
          type: e.type ?? "",
          sha: e.sha ?? "",
        })),
      };
    },

    async putFile({ path, content, sha, message, branch }) {
      const { data } = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        branch,
        content: toBase64(content),
        ...(sha ? { sha } : {}),
      });
      return { sha: data.content?.sha ?? "" };
    },

    async deleteFile({ path, sha, message, branch }) {
      await octokit.rest.repos.deleteFile({
        owner,
        repo,
        path,
        sha,
        message,
        branch,
      });
    },

    async getRefSha(branch) {
      const { data } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      return data.object.sha;
    },

    async getCommitTreeSha(commitSha) {
      const { data } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: commitSha,
      });
      return data.tree.sha;
    },

    async createBlob(content) {
      const { data } = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: toBase64(content),
        encoding: "base64",
      });
      return data.sha;
    },

    async createTree(baseTree, entries) {
      const { data } = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseTree,
        tree: entries.map((e) => ({
          path: e.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: e.sha,
        })),
      });
      return data.sha;
    },

    async createCommit(message, tree, parent) {
      const { data } = await octokit.rest.git.createCommit({
        owner,
        repo,
        message,
        tree,
        parents: [parent],
      });
      return data.sha;
    },

    async updateRef(branch, sha) {
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha,
        force: false,
      });
    },
  };
}
