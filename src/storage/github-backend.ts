import {
  ConflictError,
  ValidationError,
  type CommitInput,
  type StorageBackend,
} from "./types";

/**
 * The GitHub REST calls the backend needs, as a narrow interface so tests
 * can mock it. `createOctokitApi` implements it with Octokit.
 */
export interface GitHubApi {
  /** File or directory at `ref`; `null` on 404. File content is absent when larger than 1 MB. */
  getContent(
    path: string,
    ref: string,
  ): Promise<
    | { type: "file"; sha: string; content?: Uint8Array }
    | {
        type: "dir";
        entries: {
          name: string;
          path: string;
          type: "file" | "dir";
          sha: string;
        }[];
      }
    | null
  >;
  getBlob(sha: string): Promise<Uint8Array>;
  getTree(sha: string): Promise<{
    entries: { path: string; type: string; sha: string }[];
    truncated: boolean;
  }>;
  putFile(input: {
    path: string;
    content: Uint8Array;
    sha?: string;
    message: string;
    branch: string;
  }): Promise<{ sha: string }>;
  deleteFile(input: {
    path: string;
    sha: string;
    message: string;
    branch: string;
  }): Promise<void>;
  getRefSha(branch: string): Promise<string>;
  getCommitTreeSha(commitSha: string): Promise<string>;
  createBlob(content: Uint8Array): Promise<string>;
  createTree(
    baseTree: string,
    entries: { path: string; sha: string | null }[],
  ): Promise<string>;
  createCommit(message: string, tree: string, parent: string): Promise<string>;
  /** Fast-forward only; rejects with status 422 if not a fast-forward. */
  updateRef(branch: string, sha: string): Promise<void>;
}

const MAX_COMMIT_ATTEMPTS = 3;

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 409 is a stale SHA; 422 "sha" is a create on an existing file or a missing sha. */
function isShaConflict(error: unknown): boolean {
  const status = statusOf(error);
  return status === 409 || (status === 422 && /sha/i.test(messageOf(error)));
}

export class GitHubBackend implements StorageBackend {
  constructor(
    private readonly api: GitHubApi,
    private readonly branch: string,
  ) {}

  async readFile(path: string) {
    return this.readAt(path, this.branch);
  }

  private async readAt(path: string, ref: string) {
    const item = await this.api.getContent(path, ref);
    if (!item || item.type !== "file") return null;
    const content = item.content ?? (await this.api.getBlob(item.sha));
    return { content, sha: item.sha };
  }

  private async shaAt(path: string, ref: string): Promise<string | null> {
    const item = await this.api.getContent(path, ref);
    return item?.type === "file" ? item.sha : null;
  }

  async listDir(path: string) {
    const item = await this.api.getContent(path, this.branch);
    if (!item || item.type !== "dir") return [];
    return [...item.entries].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listFilesRecursive(prefix: string) {
    const dir = prefix.replace(/\/$/, "");
    const slash = dir.lastIndexOf("/");
    const parent = slash === -1 ? "" : dir.slice(0, slash);
    const name = dir.slice(slash + 1);
    const parentItem = await this.api.getContent(parent, this.branch);
    if (!parentItem || parentItem.type !== "dir") return [];
    const entry = parentItem.entries.find(
      (e) => e.name === name && e.type === "dir",
    );
    if (!entry) return [];
    const tree = await this.api.getTree(entry.sha);
    if (tree.truncated) throw new Error(`Tree listing truncated for ${dir}`);
    return tree.entries
      .filter((e) => e.type === "blob")
      .map((e) => ({ path: `${dir}/${e.path}`, sha: e.sha }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async writeFile(
    path: string,
    content: Uint8Array,
    expectedSha: string | null,
    message: string,
  ) {
    const attempt = () =>
      this.api.putFile({
        path,
        content,
        sha: expectedSha ?? undefined,
        message,
        branch: this.branch,
      });
    try {
      return await attempt();
    } catch (error) {
      // A 409 can also mean the branch moved for an unrelated reason. Retry
      // once if this file is still exactly as expected.
      if (
        isShaConflict(error) &&
        (await this.shaAt(path, this.branch)) === expectedSha
      ) {
        try {
          return await attempt();
        } catch (retryError) {
          if (isShaConflict(retryError)) throw new ConflictError([path]);
          throw retryError;
        }
      }
      if (isShaConflict(error)) throw new ConflictError([path]);
      throw error;
    }
  }

  async deleteFile(path: string, expectedSha: string, message: string) {
    try {
      await this.api.deleteFile({
        path,
        sha: expectedSha,
        message,
        branch: this.branch,
      });
    } catch (error) {
      if (isShaConflict(error) || statusOf(error) === 404)
        throw new ConflictError([path]);
      throw error;
    }
  }

  async commit({ message, changes, expected }: CommitInput) {
    // Blobs are content-addressed, so create them once for all attempts.
    const blobShas = new Map<string, string>();
    for (const change of changes) {
      if ("blobSha" in change) blobShas.set(change.path, change.blobSha);
      else if (change.content !== null) {
        blobShas.set(change.path, await this.api.createBlob(change.content));
      }
    }
    const usesUploadedBlobs = changes.some((c) => "blobSha" in c);

    for (let attempt = 1; attempt <= MAX_COMMIT_ATTEMPTS; attempt++) {
      const head = await this.api.getRefSha(this.branch);
      const conflicts: string[] = [];
      await Promise.all(
        Object.entries(expected).map(async ([path, sha]) => {
          if ((await this.shaAt(path, head)) !== sha) conflicts.push(path);
        }),
      );
      if (conflicts.length > 0) throw new ConflictError(conflicts.sort());

      const baseTree = await this.api.getCommitTreeSha(head);
      let tree: string;
      try {
        tree = await this.api.createTree(
          baseTree,
          changes.map((c) => ({
            path: c.path,
            sha: blobShas.get(c.path) ?? null,
          })),
        );
      } catch (error) {
        // GitHub answers 422 for a tree entry whose blob doesn't exist.
        if (usesUploadedBlobs && statusOf(error) === 422) {
          throw new ValidationError("unknownBlob");
        }
        throw error;
      }
      const commitSha = await this.api.createCommit(message, tree, head);
      try {
        await this.api.updateRef(this.branch, commitSha);
        return { commitSha };
      } catch (error) {
        // Not a fast-forward: someone committed in between. Rebuild on the new head.
        if (statusOf(error) !== 422 || attempt === MAX_COMMIT_ATTEMPTS) {
          if (statusOf(error) === 422) {
            throw new ConflictError(changes.map((c) => c.path));
          }
          throw error;
        }
      }
    }
    throw new ConflictError(changes.map((c) => c.path));
  }
}
