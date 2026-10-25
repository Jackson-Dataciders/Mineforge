import { describe, expect, it } from "vitest";
import { recipesProducing, searchSetOf, type ItemSource } from "./item-sources";

const item = (id: string, name: string) => ({
  id,
  name,
  icon: null,
  source: "extracted" as const,
});

const smelt = (id: string, result: string) => ({
  id,
  type: "minecraft:smelting",
  source: "extracted" as const,
  data: {
    type: "minecraft:smelting",
    ingredient: { item: "minecraft:x" },
    result: { id: result },
  },
});

const vanilla: ItemSource = {
  modId: null,
  modName: "Minecraft",
  items: [
    item("minecraft:stone", "Stone"),
    item("minecraft:iron_ingot", "Iron Ingot"),
  ],
  recipes: [
    smelt("minecraft:stone", "minecraft:stone"),
    smelt("minecraft:b", "minecraft:iron_ingot"),
  ],
  tags: { "minecraft:stones": { replace: false, values: [] } },
};

const mod: ItemSource = {
  modId: "alpha",
  modName: "Alpha",
  items: [
    item("minecraft:stone", "Overridden Stone"),
    item("alpha:gear", "Gear"),
  ],
  recipes: [
    smelt("alpha:a", "minecraft:iron_ingot"),
    // Same ID as a vanilla recipe: the mod's version replaces it.
    smelt("minecraft:b", "alpha:gear"),
  ],
  tags: {
    "c:gears": { replace: false, values: [] },
    "minecraft:stones": { replace: false, values: [] },
  },
};

describe("searchSetOf", () => {
  it("keeps the first occurrence of an item, sorts by ID and unions tags", () => {
    const set = searchSetOf([vanilla, mod]);
    expect(set.items.map((i) => `${i.id}=${i.name}@${i.modName}`)).toEqual([
      "alpha:gear=Gear@Alpha",
      "minecraft:iron_ingot=Iron Ingot@Minecraft",
      "minecraft:stone=Stone@Minecraft",
    ]);
    expect(set.tags).toEqual(["c:gears", "minecraft:stones"]);
  });
});

describe("recipesProducing", () => {
  it("finds recipes by output; a later source overrides a recipe ID", () => {
    expect(
      recipesProducing([vanilla, mod], "minecraft:iron_ingot").map(
        (r) => `${r.id}@${r.modName}`,
      ),
    ).toEqual(["alpha:a@Alpha"]);
    expect(
      recipesProducing([vanilla, mod], "alpha:gear").map(
        (r) => `${r.id}@${r.modName}`,
      ),
    ).toEqual(["minecraft:b@Alpha"]);
  });
});
