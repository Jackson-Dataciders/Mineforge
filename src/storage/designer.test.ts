import { describe, expect, it } from "vitest";
import { defaultEntry, type Entry } from "@/domain/entry";
import { encodeJson } from "@/lib/stable-json";
import {
  createRecipeType,
  deleteRecipeType,
  getCustomMod,
  setCustomModDependencies,
  updateRecipeType,
} from "./custom-mods";
import {
  createEntry,
  deleteEntry,
  getEntry,
  listEntries,
  updateEntry,
} from "./entries";
import { MemoryBackend } from "./memory-backend";
import {
  loadDesignerItemSources,
  loadPackItemSources,
  searchSetOfItemSet,
} from "./pack-items";
import { isConflictError, isValidationError } from "./types";

const ICON = (() => {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  view.setUint32(16, 16);
  view.setUint32(20, 16);
  return bytes;
})();

function seeded() {
  return new MemoryBackend({
    "data/custom-mods/mine/mod.json": encodeJson({
      modId: "mine",
      name: "Mine",
      phase: "planning",
      dependencies: [],
    }),
    "data/modpacks/pack/pack.json": encodeJson({
      id: "pack",
      name: "Pack",
      libraryModIds: [],
      customModIds: ["mine"],
    }),
    "data/vanilla/1.21.1/items.json": encodeJson([
      { id: "minecraft:stone", name: "Stone", icon: null, source: "extracted" },
    ]),
    "data/library/alpha/meta.json": encodeJson({
      modId: "alpha",
      name: "Alpha",
      version: "1",
      loader: "neoforge",
      minecraftVersionRange: null,
      modIds: ["alpha"],
      jarFile: "jars/mods/alpha.jar",
      jarSha256: "0".repeat(64),
      dependencies: [],
    }),
    "data/library/alpha/items.json": encodeJson([
      { id: "alpha:gear", name: "Gear", icon: null, source: "extracted" },
    ]),
  });
}

const reason = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (e: unknown) =>
      isValidationError(e)
        ? e.code
        : isConflictError(e)
          ? "conflict"
          : String(e),
  );

const sha = async (storage: MemoryBackend, path: string) =>
  (await storage.readFile(path))!.sha;

describe("entries", () => {
  it("creates an entry with its icon in one commit", async () => {
    const storage = seeded();
    const created = await createEntry(
      storage,
      "mine",
      defaultEntry("item", "mine:ingot", "Ingot"),
      ICON,
    );
    expect(created.data.icon).toBe(true);
    expect(storage.log).toEqual(["data: create entry mine:ingot"]);
    expect(
      await storage.readFile("assets/icons/mine/ingot.png"),
    ).not.toBeNull();
    expect(created.sha).toBe(
      await sha(storage, "data/custom-mods/mine/entries/ingot.json"),
    );
    expect((await listEntries(storage, "mine")).map((e) => e.data.id)).toEqual([
      "mine:ingot",
    ]);
  });

  it("rejects duplicate IDs, foreign IDs, bad icons and unknown targets", async () => {
    const storage = seeded();
    await createEntry(
      storage,
      "mine",
      defaultEntry("item", "mine:ingot", "Ingot"),
      undefined,
    );
    expect(
      await reason(
        createEntry(
          storage,
          "mine",
          defaultEntry("block", "mine:ingot", "X"),
          undefined,
        ),
      ),
    ).toBe("idTaken");
    expect(
      await reason(
        createEntry(
          storage,
          "mine",
          defaultEntry("item", "other:x", "X"),
          undefined,
        ),
      ),
    ).toBe("invalidId");
    expect(
      await reason(
        createEntry(
          storage,
          "mine",
          defaultEntry("item", "mine:x", "X"),
          new Uint8Array(40),
        ),
      ),
    ).toBe("invalidIcon");
    const linked = {
      ...defaultEntry("item", "mine:y", "Y"),
      relations: [{ type: "powers", target: "mine:nope" }],
    };
    expect(await reason(createEntry(storage, "mine", linked, undefined))).toBe(
      "unknownEntry",
    );
  });

  it("updates with the SHA, keeps or removes the icon, and never changes the ID", async () => {
    const storage = seeded();
    const created = await createEntry(
      storage,
      "mine",
      defaultEntry("item", "mine:ingot", "Ingot"),
      ICON,
    );
    const renamed = await updateEntry(
      storage,
      "mine",
      "ingot",
      { ...created.data, name: "Iron Ingot", status: "planned" },
      created.sha,
      undefined,
    );
    expect(renamed.data).toMatchObject({ name: "Iron Ingot", icon: true });
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "ingot",
          created.data,
          created.sha,
          undefined,
        ),
      ),
    ).toBe("conflict");
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "ingot",
          { ...renamed.data, id: "mine:other" },
          renamed.sha,
          undefined,
        ),
      ),
    ).toBe("invalidId");
    const noIcon = await updateEntry(
      storage,
      "mine",
      "ingot",
      renamed.data,
      renamed.sha,
      null,
    );
    expect(noIcon.data.icon).toBe(false);
    expect(await storage.readFile("assets/icons/mine/ingot.png")).toBeNull();
  });

  it("deletes an entry, its icon and relations to it in one commit", async () => {
    const storage = seeded();
    const target = await createEntry(
      storage,
      "mine",
      defaultEntry("block", "mine:ore", "Ore"),
      ICON,
    );
    await createEntry(
      storage,
      "mine",
      {
        ...defaultEntry("mechanic", "mine:heat", "Heat"),
        involvedEntries: ["mine:ore"],
        relations: [{ type: "powers", target: "mine:ore" }],
      },
      undefined,
    );
    storage.log.length = 0;
    await deleteEntry(storage, "mine", "ore", target.sha);
    expect(storage.log).toEqual(["data: delete entry mine:ore"]);
    expect(await getEntry(storage, "mine", "ore")).toBeNull();
    expect(await storage.readFile("assets/icons/mine/ore.png")).toBeNull();
    const heat = (await getEntry(storage, "mine", "heat"))!.data as Extract<
      Entry,
      { type: "mechanic" }
    >;
    expect(heat.relations).toEqual([]);
    // Other references stay and show as missing; the entry can still be edited.
    expect(heat.involvedEntries).toEqual(["mine:ore"]);
    const heatSha = await sha(
      storage,
      "data/custom-mods/mine/entries/heat.json",
    );
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "heat",
          { ...heat, notes: "x" },
          heatSha,
          undefined,
        ),
      ),
    ).toBe("ok");
  });
});

describe("dependencies and recipe types", () => {
  it("sets known library dependencies only", async () => {
    const storage = seeded();
    const modSha = await sha(storage, "data/custom-mods/mine/mod.json");
    expect(
      await reason(setCustomModDependencies(storage, "mine", ["nope"], modSha)),
    ).toBe("unknownMod");
    const saved = await setCustomModDependencies(
      storage,
      "mine",
      ["alpha"],
      modSha,
    );
    expect(saved.data.dependencies).toEqual(["alpha"]);
  });

  it("creates, updates and deletes recipe types with a valid machine", async () => {
    const storage = seeded();
    await createEntry(
      storage,
      "mine",
      defaultEntry("block", "mine:smelter", "Smelter"),
      undefined,
    );
    await createEntry(
      storage,
      "mine",
      defaultEntry("item", "mine:ingot", "Ingot"),
      undefined,
    );
    const type = {
      id: "melting",
      name: "Melting",
      machine: "mine:smelter",
      inputs: [{ type: "item" }],
      outputs: [{ type: "fluid", chance: false }],
      parameters: { processingTime: true, energyCost: false },
    };
    let modSha = await sha(storage, "data/custom-mods/mine/mod.json");
    expect(
      await reason(
        createRecipeType(
          storage,
          "mine",
          { ...type, machine: "mine:ingot" },
          modSha,
        ),
      ),
    ).toBe("invalidMachine");
    const created = await createRecipeType(storage, "mine", type, modSha);
    expect(
      await reason(createRecipeType(storage, "mine", type, created.sha)),
    ).toBe("idTaken");
    const updated = await updateRecipeType(
      storage,
      "mine",
      "melting",
      { ...type, name: "Smelting" },
      created.sha,
    );
    expect(updated.data.recipeTypes[0]?.name).toBe("Smelting");
    modSha = updated.sha;

    // A recipe must match its type.
    const ingot = (await getEntry(storage, "mine", "ingot"))!;
    const recipe = {
      type: "custom",
      recipeType: "melting",
      inputs: [{ type: "item", ingredient: { item: "minecraft:stone" } }],
      outputs: [{ type: "fluid", fluid: "mine:molten", amount: 144 }],
      processingTime: 100,
    };
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "ingot",
          {
            ...ingot.data,
            recipes: [{ ...recipe, processingTime: undefined }],
          },
          ingot.sha,
          undefined,
        ),
      ),
    ).toBe("invalidRecipe");
    const withRecipe = await updateEntry(
      storage,
      "mine",
      "ingot",
      { ...ingot.data, recipes: [recipe] },
      ingot.sha,
      undefined,
    );

    await deleteRecipeType(storage, "mine", "melting", modSha);
    expect((await getCustomMod(storage, "mine"))!.data.recipeTypes).toEqual([]);
    // The orphaned recipe may stay unchanged, but can't be edited into a new one.
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "ingot",
          { ...withRecipe.data, notes: "x" },
          withRecipe.sha,
          undefined,
        ),
      ),
    ).toBe("ok");
  });
});

describe("recipe type references", () => {
  it("rejects unknown recipe types and keeps unchanged recipes of an edited type", async () => {
    const storage = seeded();
    await createEntry(
      storage,
      "mine",
      defaultEntry("block", "mine:smelter", "Smelter"),
      undefined,
    );
    const custom = {
      type: "custom",
      recipeType: "melting",
      inputs: [{ type: "item", ingredient: { item: "minecraft:stone" } }],
      outputs: [{ type: "fluid", fluid: "mine:molten", amount: 144 }],
      processingTime: 100,
    };
    expect(
      await reason(
        createEntry(
          storage,
          "mine",
          { ...defaultEntry("item", "mine:ingot", "Ingot"), recipes: [custom] },
          undefined,
        ),
      ),
    ).toBe("unknownRecipeType");
    expect(
      await reason(
        createEntry(
          storage,
          "mine",
          {
            ...defaultEntry("multiblock", "mine:big", "Big"),
            recipeTypes: ["melting"],
          },
          undefined,
        ),
      ),
    ).toBe("unknownRecipeType");

    const type = {
      id: "melting",
      name: "Melting",
      machine: "mine:smelter",
      inputs: [{ type: "item" }],
      outputs: [{ type: "fluid", chance: false }],
      parameters: { processingTime: true, energyCost: false },
    };
    const mod = await createRecipeType(
      storage,
      "mine",
      type,
      await sha(storage, "data/custom-mods/mine/mod.json"),
    );
    const ingot = await createEntry(
      storage,
      "mine",
      { ...defaultEntry("item", "mine:ingot", "Ingot"), recipes: [custom] },
      undefined,
    );
    // The type drops its processing time; the stored recipe no longer matches.
    await updateRecipeType(
      storage,
      "mine",
      "melting",
      { ...type, parameters: { processingTime: false, energyCost: false } },
      mod.sha,
    );
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "ingot",
          { ...ingot.data, notes: "x" },
          ingot.sha,
          undefined,
        ),
      ),
    ).toBe("ok");
    const again = (await getEntry(storage, "mine", "ingot"))!;
    expect(
      await reason(
        updateEntry(
          storage,
          "mine",
          "ingot",
          { ...again.data, recipes: [{ ...custom, processingTime: 50 }] },
          again.sha,
          undefined,
        ),
      ),
    ).toBe("invalidRecipe");
  });
});

describe("item sets", () => {
  it("designer: vanilla + dependencies + all item/block entries", async () => {
    const storage = seeded();
    await setCustomModDependencies(
      storage,
      "mine",
      ["alpha"],
      await sha(storage, "data/custom-mods/mine/mod.json"),
    );
    await createEntry(
      storage,
      "mine",
      defaultEntry("item", "mine:ingot", "Ingot"),
      ICON,
    );
    await createEntry(
      storage,
      "mine",
      defaultEntry("entity", "mine:golem", "Golem"),
      undefined,
    );
    const set = searchSetOfItemSet(
      await loadDesignerItemSources(storage, "mine"),
    );
    expect(set.items.map((i) => i.id)).toEqual([
      "alpha:gear",
      "mine:ingot",
      "minecraft:stone",
    ]);
    expect(set.items[1]).toMatchObject({
      source: "entry",
      status: "backlog",
      icon: { kind: "icon", path: "mine/ingot.png" },
    });
  });

  it("pack: only planned or implemented entries of the pack's custom mods", async () => {
    const storage = seeded();
    await createEntry(
      storage,
      "mine",
      defaultEntry("item", "mine:ingot", "Ingot"),
      undefined,
    );
    await createEntry(
      storage,
      "mine",
      { ...defaultEntry("block", "mine:ore", "Ore"), status: "planned" },
      undefined,
    );
    const set = searchSetOfItemSet(await loadPackItemSources(storage, "pack"));
    expect(set.items.map((i) => i.id)).toEqual(["mine:ore", "minecraft:stone"]);
  });
});
