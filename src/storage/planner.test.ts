import { describe, expect, it } from "vitest";
import { encodeJson } from "@/lib/stable-json";
import { commitUploadedJars } from "./jars";
import { loadItemSources, loadLibraryOverview } from "./library";
import { MemoryBackend } from "./memory-backend";
import { setModpackMods } from "./modpacks";
import {
  createManualPackTask,
  deletePackTask,
  readPackTasks,
  setPackTaskDone,
} from "./pack-tasks";
import {
  createRecipeChange,
  deleteRecipeChange,
  getRecipeChange,
  listRecipeChanges,
  updateRecipeChange,
  type RecipeChangeInput,
} from "./recipe-changes";
import { isConflictError, isNotFoundError, isValidationError } from "./types";

const meta = (modId: string, extra: object = {}) => ({
  modId,
  name: modId.toUpperCase(),
  version: "1.0",
  loader: "neoforge",
  minecraftVersionRange: "[1.21.1]",
  modIds: [modId],
  jarFile: `jars/mods/${modId}.jar`,
  jarSha256: "0".repeat(64),
  dependencies: [],
  ...extra,
});

const item = (id: string, name: string, source = "extracted") => ({
  id,
  name,
  icon: null,
  source,
  ...(source === "inferred" ? { evidence: "Foo.register" } : {}),
});

function seeded() {
  return new MemoryBackend({
    "data/modpacks/pack/pack.json": encodeJson({
      id: "pack",
      name: "Pack",
      libraryModIds: [],
      customModIds: [],
    }),
    "data/custom-mods/mine/mod.json": encodeJson({
      modId: "mine",
      name: "Mine",
      phase: "planning",
      dependencies: [],
    }),
    "data/vanilla/1.21.1/items.json": encodeJson([
      item("minecraft:stone", "Stone"),
    ]),
    "data/vanilla/1.21.1/recipes.json": encodeJson([
      {
        id: "minecraft:stone",
        type: "minecraft:smelting",
        source: "extracted",
        data: {
          type: "minecraft:smelting",
          ingredient: { item: "minecraft:cobblestone" },
          result: { id: "minecraft:stone" },
        },
      },
    ]),
    "data/vanilla/1.21.1/tags.json": encodeJson({
      "minecraft:stones": { replace: false, values: ["minecraft:stone"] },
    }),
    // Old meta without `logo`: still valid (ADR 0019).
    "data/library/alpha/meta.json": encodeJson(meta("alpha")),
    "data/library/alpha/items.json": encodeJson([
      item("alpha:gear", "Gear"),
      item("alpha:rod", "Rod", "inferred"),
      item("minecraft:stone", "Duplicate Stone"),
    ]),
    "data/library/alpha/recipes.json": encodeJson([]),
    "data/library/fab-mod/meta.json": encodeJson(
      meta("fab-mod", { loader: "fabric", logo: "fab-mod/_logo.png" }),
    ),
    "jars/mods/alpha.jar": "a",
    "jars/mods/fab-mod.jar": "f",
    "jars/mods/pending-1.0.jar": "p",
    "jars/mods/readme.txt": "x",
  });
}

const stonecutting = (count = 1): RecipeChangeInput => ({
  item: "minecraft:stone",
  itemName: "Stone",
  action: "replace",
  replacedRecipeId: "minecraft:stone",
  recipe: {
    type: "minecraft:stonecutting",
    ingredient: { item: "minecraft:cobblestone" },
    result: { id: "minecraft:stone", count },
  },
});

describe("library", () => {
  it("lists mods with counts, pending jars and vanilla status", async () => {
    const overview = await loadLibraryOverview(seeded());
    expect(overview.mods.map((m) => m.meta.modId)).toEqual([
      "alpha",
      "fab-mod",
    ]);
    expect(overview.mods[0]).toMatchObject({
      itemCount: 3,
      inferredItemCount: 1,
      recipeCount: 0,
      meta: { logo: null },
    });
    expect(overview.mods[1]?.meta.logo).toBe("fab-mod/_logo.png");
    expect(overview.pendingJars).toEqual(["pending-1.0.jar"]);
    expect(overview.hasVanillaData).toBe(true);
  });

  it("loads vanilla first, then the requested mods, and sees updated files", async () => {
    const storage = seeded();
    const sources = await loadItemSources(storage, ["alpha", "missing"]);
    expect(sources.map((s) => s.modName)).toEqual(["Minecraft", "ALPHA"]);
    await storage.writeFile(
      "data/library/alpha/items.json",
      encodeJson([item("alpha:new", "New")]),
      (await storage.readFile("data/library/alpha/items.json"))!.sha,
      "update",
    );
    const reloaded = await loadItemSources(storage, ["alpha"]);
    expect(reloaded[1]?.items.map((i) => i.id)).toEqual(["alpha:new"]);
  });
});

describe("jar upload commit", () => {
  it("commits uploaded blobs in one commit", async () => {
    const storage = seeded();
    const a = storage.storeBlob(new TextEncoder().encode("jar-a"));
    const b = storage.storeBlob(new TextEncoder().encode("jar-b"));
    await commitUploadedJars(storage, [
      { name: "a-1.0.jar", sha: a },
      { name: "b-2.0.jar", sha: b },
    ]);
    expect(storage.log).toEqual(["data: upload jars a-1.0.jar, b-2.0.jar"]);
    expect((await storage.readFile("jars/mods/b-2.0.jar"))?.sha).toBe(b);
    expect((await loadLibraryOverview(storage)).pendingJars).toEqual([
      "a-1.0.jar",
      "b-2.0.jar",
      "pending-1.0.jar",
    ]);
  });

  it("rejects existing names, unknown blobs and unsafe names", async () => {
    const storage = seeded();
    const sha = storage.storeBlob(new TextEncoder().encode("x"));
    const reject = (jars: { name: string; sha: string }[]) =>
      commitUploadedJars(storage, jars).catch((e: unknown) =>
        isValidationError(e) ? e.code : "other",
      );
    expect(await reject([{ name: "alpha.jar", sha }])).toBe("jarExists");
    expect(await reject([{ name: "new.jar", sha: "a".repeat(40) }])).toBe(
      "unknownBlob",
    );
    expect(await reject([{ name: "../evil.jar", sha }])).toBe("invalidInput");
    expect(await reject([])).toBe("invalidInput");
    expect(storage.log).toEqual([]);
  });
});

describe("modpack mods", () => {
  it("sets known mods and rejects unknown IDs", async () => {
    const storage = seeded();
    const sha = (await storage.readFile("data/modpacks/pack/pack.json"))!.sha;
    const saved = await setModpackMods(
      storage,
      "pack",
      { libraryModIds: ["fab-mod", "alpha", "alpha"], customModIds: ["mine"] },
      sha,
    );
    expect(saved.data).toMatchObject({
      libraryModIds: ["alpha", "fab-mod"],
      customModIds: ["mine"],
    });
    await expect(
      setModpackMods(
        storage,
        "pack",
        { libraryModIds: ["nope"], customModIds: [] },
        saved.sha,
      ),
    ).rejects.toMatchObject({ code: "unknownMod" });
    await expect(
      setModpackMods(
        storage,
        "pack",
        { libraryModIds: [], customModIds: [] },
        sha,
      ),
    ).rejects.toSatisfy(isConflictError);
  });
});

describe("recipe changes", () => {
  it("creates the change and its KubeJS task in one commit", async () => {
    const storage = seeded();
    const created = await createRecipeChange(storage, "pack", stonecutting());
    expect(created.data.id).toBe("stone");
    expect(storage.log).toEqual(["data: add recipe change pack/stone"]);
    const tasks = await readPackTasks(storage, "pack");
    expect(tasks.data.tasks).toMatchObject([
      { type: "kubejs", recipeChangeId: "stone", done: false },
    ]);
    const second = await createRecipeChange(storage, "pack", {
      item: "minecraft:stone",
      itemName: "Stone",
      action: "remove",
      removedRecipeId: "minecraft:stone_from_x",
    });
    expect(second.data.id).toBe("stone_2");
    expect(
      (await listRecipeChanges(storage, "pack")).map((c) => c.data.id),
    ).toEqual(["stone", "stone_2"]);
  });

  it("editing reopens the task; deleting removes the change and its task", async () => {
    const storage = seeded();
    const created = await createRecipeChange(storage, "pack", stonecutting());
    const tasks = await readPackTasks(storage, "pack");
    const taskId = tasks.data.tasks[0]!.id;
    await setPackTaskDone(storage, "pack", taskId, true, tasks.sha);

    const updated = await updateRecipeChange(
      storage,
      "pack",
      "stone",
      {
        ...stonecutting(4),
        item: "minecraft:dirt",
        itemName: "Dirt",
      } as RecipeChangeInput,
      created.sha,
    );
    // Item and name are fixed at creation.
    expect(updated.data).toMatchObject({
      item: "minecraft:stone",
      itemName: "Stone",
    });
    expect((await readPackTasks(storage, "pack")).data.tasks[0]?.done).toBe(
      false,
    );
    await expect(
      updateRecipeChange(
        storage,
        "pack",
        "stone",
        stonecutting(2),
        created.sha,
      ),
    ).rejects.toSatisfy(isConflictError);

    await deleteRecipeChange(storage, "pack", "stone", updated.sha);
    expect(await getRecipeChange(storage, "pack", "stone")).toBeNull();
    expect((await readPackTasks(storage, "pack")).data.tasks).toEqual([]);
  });

  it("rejects invalid changes and unknown packs", async () => {
    const storage = seeded();
    await expect(
      createRecipeChange(storage, "pack", {
        ...stonecutting(),
        recipe: {
          type: "minecraft:stonecutting",
          ingredient: { item: "minecraft:cobblestone" },
          result: { id: "minecraft:dirt", count: 1 },
        },
      } as RecipeChangeInput),
    ).rejects.toThrow();
    await expect(
      createRecipeChange(storage, "nope", stonecutting()),
    ).rejects.toSatisfy(isNotFoundError);
    expect(storage.log).toEqual([]);
  });
});

describe("pack tasks", () => {
  it("adds, checks and deletes manual tasks with SHA checks", async () => {
    const storage = seeded();
    const empty = await readPackTasks(storage, "pack");
    expect(empty).toEqual({ data: { tasks: [] }, sha: null });
    const added = await createManualPackTask(
      storage,
      "pack",
      "Test the pack",
      null,
    );
    const id = added.data.tasks[0]!.id;
    expect(id).toMatch(/^[a-f0-9]{12}$/);
    await expect(
      createManualPackTask(storage, "pack", "Again", null),
    ).rejects.toSatisfy(isConflictError);
    const checked = await setPackTaskDone(storage, "pack", id, true, added.sha);
    expect(checked.data.tasks[0]?.done).toBe(true);
    const deleted = await deletePackTask(storage, "pack", id, checked.sha);
    expect(deleted.data.tasks).toEqual([]);
  });

  it("refuses to delete KubeJS tasks directly", async () => {
    const storage = seeded();
    await createRecipeChange(storage, "pack", stonecutting());
    const tasks = await readPackTasks(storage, "pack");
    await expect(
      deletePackTask(storage, "pack", tasks.data.tasks[0]!.id, tasks.sha),
    ).rejects.toMatchObject({ code: "notManualTask" });
  });
});
