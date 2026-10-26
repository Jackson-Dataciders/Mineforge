import { describe, expect, it } from "vitest";
import { defaultEntry } from "@/domain/entry";
import { encodeJson } from "@/lib/stable-json";
import { readLayout, saveLayout } from "./layout";
import { MemoryBackend } from "./memory-backend";
import { isConflictError, isNotFoundError } from "./types";

function seeded() {
  return new MemoryBackend({
    "data/custom-mods/mine/mod.json": encodeJson({
      modId: "mine",
      name: "Mine",
      phase: "planning",
      dependencies: [],
      recipeTypes: [],
    }),
    "data/custom-mods/mine/entries/gear.json": encodeJson({
      ...defaultEntry("item", "mine:gear", "Gear"),
      recipes: [
        {
          type: "minecraft:crafting_shapeless",
          ingredients: [{ item: "minecraft:iron_ingot" }],
          result: { id: "mine:gear", count: 1 },
        },
      ],
    }),
  });
}

describe("layout", () => {
  it("reads an empty layout when layout.json is missing", async () => {
    expect(await readLayout(seeded(), "mine")).toEqual({
      data: { positions: {} },
      sha: null,
    });
  });

  it("saves rounded positions of known nodes only", async () => {
    const storage = seeded();
    const saved = await saveLayout(
      storage,
      "mine",
      {
        "mine:gear": { x: 10.4, y: 20.6 },
        "minecraft:iron_ingot": { x: -5, y: 0 },
        "mine:gone": { x: 1, y: 1 },
      },
      null,
    );
    expect(saved.data.positions).toEqual({
      "mine:gear": { x: 10, y: 21 },
      "minecraft:iron_ingot": { x: -5, y: 0 },
    });
    expect(storage.log).toEqual(["data: update layout of custom mod mine"]);
    expect(await readLayout(storage, "mine")).toEqual(saved);
  });

  it("doesn't write a save that changes nothing", async () => {
    const storage = seeded();
    const first = await saveLayout(
      storage,
      "mine",
      { "mine:gear": { x: 1, y: 2 } },
      null,
    );
    const again = await saveLayout(
      storage,
      "mine",
      { "mine:gear": { x: 1.2, y: 2 } },
      first.sha,
    );
    expect(again).toEqual(first);
    expect(storage.log).toHaveLength(1);
  });

  it("rejects stale SHAs and unknown mods", async () => {
    const storage = seeded();
    await saveLayout(storage, "mine", {}, null);
    await expect(saveLayout(storage, "mine", {}, null)).rejects.toSatisfy(
      isConflictError,
    );
    await expect(saveLayout(storage, "nope", {}, null)).rejects.toSatisfy(
      isNotFoundError,
    );
  });
});
