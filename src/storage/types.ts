/** A file as stored in the repo, with its git blob SHA. */
export type StoredFile = { content: Uint8Array; sha: string };

export type DirEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
};

export type FileRef = { path: string; sha: string };

/** One file in an atomic commit. `content: null` deletes the file. */
export type FileChange = { path: string; content: Uint8Array | null };

export type CommitInput = {
  message: string;
  changes: FileChange[];
  /**
   * Blob SHA each path must have at the head the commit is built on.
   * `null` means the path must not exist. Paths not listed are not checked.
   */
  expected: Record<string, string | null>;
};

/**
 * The only interface through which app code reads or writes repo data
 * (ADR 0002). Paths are repo-relative with forward slashes.
 */
export interface StorageBackend {
  readFile(path: string): Promise<StoredFile | null>;
  /** Direct children of a directory; empty if it doesn't exist. */
  listDir(path: string): Promise<DirEntry[]>;
  /** All files below a directory, recursively; empty if it doesn't exist. */
  listFilesRecursive(prefix: string): Promise<FileRef[]>;
  /** Single-file write. `expectedSha: null` creates and fails if the file exists. */
  writeFile(
    path: string,
    content: Uint8Array,
    expectedSha: string | null,
    message: string,
  ): Promise<{ sha: string }>;
  deleteFile(path: string, expectedSha: string, message: string): Promise<void>;
  /** Several changes as one commit; all or nothing. */
  commit(input: CommitInput): Promise<{ commitSha: string }>;
}

/** The data changed since it was read. Reload instead of overwriting. */
export class ConflictError extends Error {
  readonly paths: string[];
  constructor(paths: string[]) {
    super(`Conflict on ${paths.join(", ")}`);
    this.name = "ConflictError";
    this.paths = paths;
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`Not found: ${what}`);
    this.name = "NotFoundError";
  }
}

/** Input that fails a domain rule (e.g. duplicate ID). */
export class ValidationError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "ValidationError";
    this.code = code;
  }
}

// Name-based guards: robust even when errors come from another copy of this
// module (e.g. the dev fake store surviving a hot reload).
const hasName = (error: unknown, name: string) =>
  error instanceof Error && error.name === name;
export const isConflictError = (e: unknown): e is ConflictError =>
  hasName(e, "ConflictError");
export const isNotFoundError = (e: unknown): e is NotFoundError =>
  hasName(e, "NotFoundError");
export const isValidationError = (e: unknown): e is ValidationError =>
  hasName(e, "ValidationError");
