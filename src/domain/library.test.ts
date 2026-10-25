import { describe, expect, it } from "vitest";
import {
  itemTagsSchema,
  libraryItemSchema,
  libraryMetaSchema,
  libraryRecipeSchema,
} from "./library";

describe("library schemas", () => {
  it("accepts extracted and evidenced inferred items", () => {
    expect(
      libraryItemSchema.safeParse({
        id: "minecraft:stone",
        name: "Stone",
        icon: "minecraft/block/stone.png",
        iconFallback: true,
        source: "extracted",
      }).success,
    ).toBe(true);
    expect(
      libraryItemSchema.safeParse({
        id: "mymod:gear",
        name: "Gear",
        icon: null,
        source: "inferred",
        evidence: "com.example.ModItems#register",
      }).success,
    ).toBe(true);
  });

  it("rejects inferred records without evidence and bad IDs or icons", () => {
    const base = { id: "mymod:gear", name: "Gear", icon: null };
    expect(
      libraryItemSchema.safeParse({ ...base, source: "inferred" }).success,
    ).toBe(false);
    expect(
      libraryItemSchema.safeParse({ ...base, id: "Gear", source: "extracted" })
        .success,
    ).toBe(false);
    expect(
      libraryItemSchema.safeParse({
        ...base,
        icon: "../x.png",
        source: "extracted",
      }).success,
    ).toBe(false);
    expect(
      libraryRecipeSchema.safeParse({
        id: "mymod:gear",
        type: "minecraft:crafting_shaped",
        source: "inferred",
        data: {},
      }).success,
    ).toBe(false);
  });

  it("validates meta and tags", () => {
    expect(
      libraryMetaSchema.safeParse({
        modId: "mymod",
        name: "My Mod",
        version: "1.0.0",
        loader: "fabric",
        minecraftVersionRange: null,
        modIds: ["mymod"],
        jarFile: "jars/mods/mymod.jar",
        jarSha256: "a".repeat(64),
        dependencies: [
          { modId: "fabric-api", type: "required", versionRange: "*" },
        ],
      }).success,
    ).toBe(true);
    expect(
      itemTagsSchema.safeParse({
        "c:ingots/iron": {
          replace: false,
          values: ["minecraft:iron_ingot", "#c:ingots/x"],
        },
        "minecraft:logs": {
          replace: false,
          values: [{ id: "mymod:log", required: false }],
        },
      }).success,
    ).toBe(true);
  });
});
