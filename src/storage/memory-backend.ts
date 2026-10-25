import { gitBlobSha } from "./git-sha";
import {
  ConflictError,
  ValidationError,
  type CommitInput,
  type DirEntry,
  type FileRef,
  type StorageBackend,
  type StoredFile,
} from "./types";

/**
 * In-memory backend with the same semantics as the GitHub backend, including
 * real git blob SHAs. Used by tests and dev fake mode (ADR 0014).
 */
export class MemoryBackend implements StorageBackend {
  private files = new Map<string, Uint8Array>();
  /** Uploaded blobs by SHA, like GitHub's object store (jar upload). */
  private blobs = new Map<string, Uint8Array>();
  private commitCount = 0;
  /** Commit messages in order, for tests. */
  readonly log: string[] = [];

  constructor(initial: Record<string, Uint8Array | string> = {}) {
    for (const [path, content] of Object.entries(initial)) {
      this.files.set(
        path,
        typeof content === "string"
          ? new TextEncoder().encode(content)
          : content,
      );
    }
  }

  async readFile(path: string): Promise<StoredFile | null> {
    const content = this.files.get(path);
    return content ? { content, sha: gitBlobSha(content) } : null;
  }

  async listDir(path: string): Promise<DirEntry[]> {
    const prefix = `${path.replace(/\/$/, "")}/`;
    const entries = new Map<string, DirEntry>();
    for (const [filePath, content] of this.files) {
      if (!filePath.startsWith(prefix)) continue;
      const rest = filePath.slice(prefix.length);
      const [name, ...deeper] = rest.split("/");
      if (!name) continue;
      if (deeper.length === 0) {
        entries.set(name, {
          name,
          path: filePath,
          type: "file",
          sha: gitBlobSha(content),
        });
      } else if (!entries.has(name)) {
        entries.set(name, { name, path: prefix + name, type: "dir", sha: "" });
      }
    }
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async listFilesRecursive(prefix: string): Promise<FileRef[]> {
    const dir = `${prefix.replace(/\/$/, "")}/`;
    return [...this.files]
      .filter(([path]) => path.startsWith(dir))
      .map(([path, content]) => ({ path, sha: gitBlobSha(content) }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async writeFile(
    path: string,
    content: Uint8Array,
    expectedSha: string | null,
    message: string,
  ): Promise<{ sha: string }> {
    this.check({ [path]: expectedSha });
    this.files.set(path, content);
    this.record(message);
    return { sha: gitBlobSha(content) };
  }

  async deleteFile(path: string, expectedSha: string, message: string) {
    this.check({ [path]: expectedSha });
    this.files.delete(path);
    this.record(message);
  }

  /** Stores a blob without committing it, like `POST git/blobs`. */
  storeBlob(content: Uint8Array): string {
    const sha = gitBlobSha(content);
    this.blobs.set(sha, content);
    return sha;
  }

  async commit({ message, changes, expected }: CommitInput) {
    for (const change of changes) {
      if ("blobSha" in change && !this.blobs.has(change.blobSha)) {
        throw new ValidationError("unknownBlob");
      }
    }
    this.check(expected);
    for (const change of changes) {
      if ("blobSha" in change) {
        this.files.set(change.path, this.blobs.get(change.blobSha)!);
      } else if (change.content === null) this.files.delete(change.path);
      else this.files.set(change.path, change.content);
    }
    return { commitSha: this.record(message) };
  }

  private check(expected: Record<string, string | null>) {
    const conflicts = Object.entries(expected)
      .filter(([path, sha]) => {
        const current = this.files.get(path);
        const currentSha = current ? gitBlobSha(current) : null;
        return currentSha !== sha;
      })
      .map(([path]) => path);
    if (conflicts.length > 0) throw new ConflictError(conflicts);
  }

  private record(message: string): string {
    this.commitCount += 1;
    this.log.push(message);
    return `memory-${this.commitCount}`;
  }
}
