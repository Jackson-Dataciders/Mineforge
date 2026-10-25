import { describe, expect, it } from "vitest";
import {
  fuzzyScore,
  searchItems,
  searchTags,
  type SearchItem,
} from "./item-search";

const item = (id: string, name: string): SearchItem => ({
  id,
  name,
  icon: null,
  source: "extracted",
  modName: "Minecraft",
});

const ITEMS = [
  item("minecraft:iron_ingot", "Iron Ingot"),
  item("minecraft:iron_pickaxe", "Iron Pickaxe"),
  item("minecraft:raw_iron", "Raw Iron"),
  item("minecraft:iron", "Iron"),
  item("minecraft:diamond_pickaxe", "Diamond Pickaxe"),
  item("farmersdelight:iron_knife", "Iron Knife"),
];

describe("fuzzyScore", () => {
  it("ranks exact > prefix > word prefix > substring > subsequence", () => {
    const scores = ["iron", "iron ingot", "raw iron", "environ", "ixrxoxn"].map(
      (t) => fuzzyScore("iron", [t]),
    );
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(new Set(scores).size).toBe(5);
    expect(fuzzyScore("xyz", ["iron"])).toBe(0);
  });
});

describe("searchItems", () => {
  it("finds by name and by ID, best match first", () => {
    expect(searchItems(ITEMS, "iron")[0]?.id).toBe("minecraft:iron");
    expect(searchItems(ITEMS, "farmersdelight:iron").map((i) => i.id)).toEqual([
      "farmersdelight:iron_knife",
    ]);
    expect(searchItems(ITEMS, "pick").map((i) => i.id)).toEqual([
      "minecraft:iron_pickaxe",
      "minecraft:diamond_pickaxe",
    ]);
  });

  it("matches several words in any order and tolerates typos as subsequences", () => {
    expect(searchItems(ITEMS, "pickaxe iron")[0]?.id).toBe(
      "minecraft:iron_pickaxe",
    );
    expect(searchItems(ITEMS, "irn ingt")[0]?.id).toBe("minecraft:iron_ingot");
  });

  it("caps results and lists by name for an empty query", () => {
    expect(searchItems(ITEMS, "", 2).map((i) => i.name)).toEqual([
      "Diamond Pickaxe",
      "Iron",
    ]);
    expect(searchItems(ITEMS, "i", 3)).toHaveLength(3);
  });
});

describe("searchTags", () => {
  it("ignores a leading #", () => {
    expect(
      searchTags(
        ["c:ingots/iron", "c:ingots/gold", "minecraft:logs"],
        "#ingots/ir",
      ),
    ).toEqual(["c:ingots/iron"]);
  });
});
