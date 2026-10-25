import { describe, expect, it } from "vitest";
import { gitBlobSha } from "./git-sha";
import { MemoryBackend } from "./memory-backend";
import { decodeJson, stableStringify } from "@/lib/stable-json";
import { ConflictError } from "./types";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("gitBlobSha", () => {
  it("matches git hash-object", () => {
    expect(gitBlobSha(bytes("hello\n"))).toBe(
      "ce013625030ba8dba906f756967f9e9ca394464a",
    );
  });
});

describe("stableStringify", () => {
  it("sorts keys recursively, keeps array order, ends with a newline", () => {
    const out = stableStringify({ b: 1, a: { d: [3, 1], c: true } });
    expect(out).toBe(
      '{\n  "a": {\n    "c": true,\n    "d": [\n      3,\n      1\n    ]\n  },\n  "b": 1\n}\n',
    );
    expect(stableStringify(decodeJson(bytes(out)))).toBe(out);
  });
});

describe("MemoryBackend", () => {
  it("creates only if absent and updates only with the current SHA", async () => {
    const storage = new MemoryBackend();
    const { sha } = await storage.writeFile(
      "a.json",
      bytes("1"),
      null,
      "create",
    );
    await expect(
      storage.writeFile("a.json", bytes("2"), null, "again"),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      storage.writeFile("a.json", bytes("2"), "stale", "x"),
    ).rejects.toBeInstanceOf(ConflictError);
    await storage.writeFile("a.json", bytes("2"), sha, "update");
    expect(
      new TextDecoder().decode((await storage.readFile("a.json"))!.content),
    ).toBe("2");
  });

  it("commits all changes or none", async () => {
    const storage = new MemoryBackend({ "d/a": "a", "d/b": "b" });
    const a = (await storage.readFile("d/a"))!;
    await expect(
      storage.commit({
        message: "m",
        changes: [
          { path: "d/a", content: null },
          { path: "d/c", content: bytes("c") },
        ],
        expected: { "d/a": a.sha, "d/b": "stale" },
      }),
    ).rejects.toEqual(new ConflictError(["d/b"]));
    expect((await storage.listFilesRecursive("d")).map((f) => f.path)).toEqual([
      "d/a",
      "d/b",
    ]);

    await storage.commit({
      message: "m",
      changes: [
        { path: "d/a", content: null },
        { path: "d/c", content: bytes("c") },
      ],
      expected: { "d/a": a.sha, "d/c": null },
    });
    expect((await storage.listFilesRecursive("d")).map((f) => f.path)).toEqual([
      "d/b",
      "d/c",
    ]);
  });

  it("lists direct children with directories", async () => {
    const storage = new MemoryBackend({
      "x/one/a": "",
      "x/two": "",
      "y/z": "",
    });
    expect((await storage.listDir("x")).map((e) => [e.name, e.type])).toEqual([
      ["one", "dir"],
      ["two", "file"],
    ]);
    expect(await storage.listDir("missing")).toEqual([]);
  });
});
