import { describe, expect, it } from "vitest";
import { resolveAssetPath } from "./assets";
import {
  createCustomMod,
  deleteCustomMod,
  getCustomMod,
  listCustomMods,
  renameCustomMod,
} from "./custom-mods";
import { MemoryBackend } from "./memory-backend";
import {
  createModpack,
  deleteModpack,
  getModpack,
  listModpacks,
  renameModpack,
} from "./modpacks";
import { encodeJson } from "@/lib/stable-json";
import { ConflictError, ValidationError } from "./types";

describe("custom mods", () => {
  it("creates with defaults, rejects duplicate and library IDs", async () => {
    const storage = new MemoryBackend({
      "data/library/create/meta.json": "{}",
    });
    const { data } = await createCustomMod(storage, {
      modId: "iron_works",
      name: "Iron Works",
    });
    expect(data).toEqual({
      modId: "iron_works",
      name: "Iron Works",
      phase: "planning",
      dependencies: [],
      recipeTypes: [],
    });
    await expect(
      createCustomMod(storage, { modId: "iron_works", name: "X" }),
    ).rejects.toEqual(new ValidationError("idTaken"));
    await expect(
      createCustomMod(storage, { modId: "create", name: "X" }),
    ).rejects.toEqual(new ValidationError("idTakenByLibrary"));
    await expect(
      createCustomMod(storage, { modId: "Bad Id", name: "X" }),
    ).rejects.toEqual(new ValidationError("invalidId"));
    for (const modId of ["minecraft", "neoforge", "kubejs"]) {
      await expect(
        createCustomMod(storage, { modId, name: "X" }),
      ).rejects.toEqual(new ValidationError("idReserved"));
    }
  });

  it("lists sorted by name and renames with SHA check", async () => {
    const storage = new MemoryBackend();
    const b = await createCustomMod(storage, { modId: "bbb", name: "Beta" });
    await createCustomMod(storage, { modId: "aaa", name: "Alpha" });
    expect((await listCustomMods(storage)).map((m) => m.data.modId)).toEqual([
      "aaa",
      "bbb",
    ]);

    const renamed = await renameCustomMod(storage, "bbb", "Beta 2", b.sha);
    expect(renamed.data.name).toBe("Beta 2");
    await expect(
      renameCustomMod(storage, "bbb", "Beta 3", b.sha),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("deletes data, icons and pack references in one commit", async () => {
    const storage = new MemoryBackend({
      "data/custom-mods/mine/entries/a.json": "{}",
      "assets/icons/mine/a.png": "png",
      "data/modpacks/pack/pack.json": new TextDecoder().decode(
        encodeJson({
          id: "pack",
          name: "Pack",
          libraryModIds: [],
          customModIds: ["mine", "other"],
        }),
      ),
    });
    const mod = await createCustomMod(storage, { modId: "mine", name: "Mine" });
    const commitsBefore = storage.log.length;
    await deleteCustomMod(storage, "mine", mod.sha);

    expect(storage.log.length).toBe(commitsBefore + 1);
    expect(await getCustomMod(storage, "mine")).toBeNull();
    expect(await storage.listFilesRecursive("data/custom-mods/mine")).toEqual(
      [],
    );
    expect(await storage.listFilesRecursive("assets/icons/mine")).toEqual([]);
    expect((await getModpack(storage, "pack"))?.data.customModIds).toEqual([
      "other",
    ]);
  });
});

describe("modpacks", () => {
  it("creates, renames and deletes", async () => {
    const storage = new MemoryBackend();
    const pack = await createModpack(storage, {
      id: "sky-pack",
      name: "Sky Pack",
    });
    expect(pack.data).toEqual({
      id: "sky-pack",
      name: "Sky Pack",
      libraryModIds: [],
      customModIds: [],
    });
    await expect(
      createModpack(storage, { id: "sky-pack", name: "Again" }),
    ).rejects.toEqual(new ValidationError("idTaken"));
    const renamed = await renameModpack(storage, "sky-pack", "Sky", pack.sha);
    await expect(
      deleteModpack(storage, "sky-pack", pack.sha),
    ).rejects.toBeInstanceOf(ConflictError);
    await deleteModpack(storage, "sky-pack", renamed.sha);
    expect(await listModpacks(storage)).toEqual([]);
  });
});

describe("resolveAssetPath", () => {
  it("maps PNG paths under textures and icons", () => {
    expect(
      resolveAssetPath("texture", ["minecraft", "item", "stone.png"]),
    ).toBe("assets/textures/minecraft/item/stone.png");
    expect(resolveAssetPath("icon", ["mine", "entry.png"])).toBe(
      "assets/icons/mine/entry.png",
    );
  });

  it.each([
    [["..", "secret.png"]],
    [["a", "."]],
    [["minecraft", "Stone.png"]],
    [["a%2F..", "b.png"]],
    [["minecraft", "stone.jpg"]],
    [["stone.png"]],
    [[]],
  ])("rejects %j", (segments) => {
    expect(resolveAssetPath("texture", segments)).toBeNull();
  });
});
