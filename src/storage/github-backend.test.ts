import { describe, expect, it } from "vitest";
import { gitBlobSha } from "./git-sha";
import { GitHubBackend, type GitHubApi } from "./github-backend";
import { ConflictError, ValidationError } from "./types";

const bytes = (s: string) => new TextEncoder().encode(s);
const httpError = (status: number, message: string) =>
  Object.assign(new Error(message), { status });

/** Minimal fake of the GitHub API over a flat file map, with failure injection. */
function fakeGitHub(initial: Record<string, string>) {
  const files = new Map<string, Uint8Array>(
    Object.entries(initial).map(([p, c]) => [p, bytes(c)]),
  );
  const trees = new Map<string, { path: string; sha: string | null }[]>();
  const blobs = new Map<string, Uint8Array>();
  const commits = new Map<string, string>();
  let head = "c0";
  let n = 0;
  const state = {
    files,
    blobs,
    refUpdates: 0,
    /** Called before each ref update; return an error to throw it. */
    beforeUpdateRef: (() => undefined) as () => Error | undefined,
    /** Errors putFile throws, in order. */
    putErrors: [] as Error[],
  };
  const api: GitHubApi = {
    async getContent(path) {
      const file = files.get(path);
      if (file) return { type: "file", sha: gitBlobSha(file), content: file };
      const prefix = path === "" ? "" : `${path}/`;
      const children = new Map<string, "file" | "dir">();
      for (const p of files.keys()) {
        if (!p.startsWith(prefix)) continue;
        const [name, ...rest] = p.slice(prefix.length).split("/");
        if (name) children.set(name, rest.length ? "dir" : "file");
      }
      if (children.size === 0) return null;
      return {
        type: "dir",
        entries: [...children].map(([name, type]) => ({
          name,
          type,
          path: prefix + name,
          sha:
            type === "dir"
              ? `tree:${prefix}${name}`
              : gitBlobSha(files.get(prefix + name)!),
        })),
      };
    },
    async getBlob(sha) {
      return [...files.values()].find((c) => gitBlobSha(c) === sha)!;
    },
    async getTree(sha) {
      const dir = `${sha.replace(/^tree:/, "")}/`;
      return {
        truncated: false,
        entries: [...files]
          .filter(([p]) => p.startsWith(dir))
          .map(([p, c]) => ({
            path: p.slice(dir.length),
            type: "blob",
            sha: gitBlobSha(c),
          })),
      };
    },
    async putFile({ path, content, sha }) {
      const error = state.putErrors.shift();
      if (error) throw error;
      const current = files.get(path);
      if (!sha && current) throw httpError(422, '"sha" wasn\'t supplied');
      if (sha && (!current || gitBlobSha(current) !== sha))
        throw httpError(409, "does not match");
      files.set(path, content);
      return { sha: gitBlobSha(content) };
    },
    async deleteFile({ path, sha }) {
      const current = files.get(path);
      if (!current) throw httpError(404, "Not Found");
      if (gitBlobSha(current) !== sha) throw httpError(409, "does not match");
      files.delete(path);
    },
    async getRefSha() {
      return head;
    },
    async getCommitTreeSha(commitSha) {
      return `base:${commitSha}`;
    },
    async createBlob(content) {
      const sha = gitBlobSha(content);
      blobs.set(sha, content);
      return sha;
    },
    async createTree(_base, entries) {
      if (entries.some((e) => e.sha !== null && !blobs.has(e.sha))) {
        throw httpError(422, "GitTree tree.sha is not a valid blob");
      }
      const sha = `t${++n}`;
      trees.set(sha, entries);
      return sha;
    },
    async createCommit(_message, tree) {
      const sha = `c${++n}`;
      commits.set(sha, tree);
      return sha;
    },
    async updateRef(_branch, sha) {
      state.refUpdates += 1;
      const error = state.beforeUpdateRef();
      if (error) throw error;
      for (const { path, sha: blob } of trees.get(commits.get(sha)!)!) {
        if (blob === null) files.delete(path);
        else files.set(path, blobs.get(blob)!);
      }
      head = sha;
    },
  };
  return { api, state };
}

describe("GitHubBackend", () => {
  it("reads files and lists directories recursively", async () => {
    const { api } = fakeGitHub({
      "data/a/x.json": "1",
      "data/a/sub/y.json": "2",
      "data/b": "3",
    });
    const storage = new GitHubBackend(api, "main");
    expect((await storage.readFile("data/a/x.json"))?.sha).toBe(
      gitBlobSha(bytes("1")),
    );
    expect(await storage.readFile("data/missing")).toBeNull();
    expect((await storage.listDir("data")).map((e) => e.name)).toEqual([
      "a",
      "b",
    ]);
    expect(
      (await storage.listFilesRecursive("data/a")).map((f) => f.path),
    ).toEqual(["data/a/sub/y.json", "data/a/x.json"]);
    expect(await storage.listFilesRecursive("data/none")).toEqual([]);
  });

  it("maps a stale SHA and create-on-existing to ConflictError", async () => {
    const { api } = fakeGitHub({ "a.json": "1" });
    const storage = new GitHubBackend(api, "main");
    await expect(
      storage.writeFile("a.json", bytes("2"), "stale", "m"),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      storage.writeFile("a.json", bytes("2"), null, "m"),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      storage.deleteFile("a.json", "stale", "m"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("retries a single-file write once when the file itself is unchanged", async () => {
    const { api, state } = fakeGitHub({ "a.json": "1" });
    state.putErrors.push(httpError(409, "branch moved"));
    const storage = new GitHubBackend(api, "main");
    await storage.writeFile("a.json", bytes("2"), gitBlobSha(bytes("1")), "m");
    expect(new TextDecoder().decode(state.files.get("a.json"))).toBe("2");
  });

  it("commits several files atomically and checks expected SHAs", async () => {
    const { api, state } = fakeGitHub({ a: "1", b: "2" });
    const storage = new GitHubBackend(api, "main");
    await expect(
      storage.commit({
        message: "m",
        changes: [{ path: "a", content: null }],
        expected: { a: "stale" },
      }),
    ).rejects.toEqual(new ConflictError(["a"]));
    expect(state.refUpdates).toBe(0);

    await storage.commit({
      message: "m",
      changes: [
        { path: "a", content: null },
        { path: "c", content: bytes("3") },
      ],
      expected: { a: gitBlobSha(bytes("1")), c: null },
    });
    expect([...state.files.keys()].sort()).toEqual(["b", "c"]);
  });

  it("rebuilds on a new head when the ref update is not a fast-forward", async () => {
    const { api, state } = fakeGitHub({ a: "1" });
    let failures = 1;
    state.beforeUpdateRef = () =>
      failures-- > 0
        ? httpError(422, "Update is not a fast forward")
        : undefined;
    const storage = new GitHubBackend(api, "main");
    await storage.commit({
      message: "m",
      changes: [{ path: "b", content: bytes("2") }],
      expected: { b: null },
    });
    expect(state.refUpdates).toBe(2);
    expect(state.files.has("b")).toBe(true);
  });

  it("gives up with a conflict after three non-fast-forward attempts", async () => {
    const { api, state } = fakeGitHub({});
    state.beforeUpdateRef = () =>
      httpError(422, "Update is not a fast forward");
    const storage = new GitHubBackend(api, "main");
    await expect(
      storage.commit({
        message: "m",
        changes: [{ path: "b", content: bytes("2") }],
        expected: {},
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(state.refUpdates).toBe(3);
  });

  it("commits blobs uploaded before (jar upload) and rejects unknown blobs", async () => {
    const { api, state } = fakeGitHub({});
    const jar = bytes("jar-bytes");
    const sha = gitBlobSha(jar);
    state.blobs.set(sha, jar);
    const storage = new GitHubBackend(api, "main");
    await storage.commit({
      message: "m",
      changes: [{ path: "jars/mods/a.jar", blobSha: sha }],
      expected: { "jars/mods/a.jar": null },
    });
    expect(state.files.get("jars/mods/a.jar")).toEqual(jar);
    await expect(
      storage.commit({
        message: "m",
        changes: [{ path: "jars/mods/b.jar", blobSha: "f".repeat(40) }],
        expected: {},
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
