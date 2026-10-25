import { describe, expect, it } from "vitest";
import {
  isChangeId,
  recipeChangeSchema,
  removedRecipeId,
  suggestChangeId,
} from "./recipe-change";

describe("suggestChangeId", () => {
  it("uses the item path and numbers collisions", () => {
    expect(suggestChangeId("minecraft:iron_pickaxe", [])).toBe("iron_pickaxe");
    expect(suggestChangeId("minecraft:iron_pickaxe", ["iron_pickaxe"])).toBe(
      "iron_pickaxe_2",
    );
    expect(
      suggestChangeId("minecraft:iron_pickaxe", [
        "iron_pickaxe",
        "iron_pickaxe_2",
      ]),
    ).toBe("iron_pickaxe_3");
  });

  it("flattens paths and never returns a reserved ID", () => {
    expect(suggestChangeId("create:crushed/raw_iron", [])).toBe(
      "crushed_raw_iron",
    );
    expect(suggestChangeId("mymod:new", [])).toBe("new_2");
    expect(isChangeId("new")).toBe(false);
  });
});

describe("recipeChangeSchema", () => {
  const base = { id: "stone", item: "minecraft:stone", itemName: "Stone" };
  const recipe = {
    type: "minecraft:stonecutting",
    ingredient: { item: "minecraft:cobblestone" },
    result: { id: "minecraft:stone", count: 1 },
  };

  it("accepts add, replace and remove", () => {
    expect(
      recipeChangeSchema.parse({ ...base, action: "add", recipe }).action,
    ).toBe("add");
    const replace = recipeChangeSchema.parse({
      ...base,
      action: "replace",
      replacedRecipeId: "minecraft:stone",
      recipe,
    });
    expect(removedRecipeId(replace)).toBe("minecraft:stone");
    const remove = recipeChangeSchema.parse({
      ...base,
      action: "remove",
      removedRecipeId: "minecraft:stone_from_x",
    });
    expect(removedRecipeId(remove)).toBe("minecraft:stone_from_x");
  });

  it("requires the visual result to be the change's item", () => {
    expect(
      recipeChangeSchema.safeParse({
        ...base,
        action: "add",
        recipe: { ...recipe, result: { id: "minecraft:dirt", count: 1 } },
      }).success,
    ).toBe(false);
  });

  it("rejects a recipe on remove changes and invalid IDs", () => {
    expect(
      recipeChangeSchema.safeParse({
        ...base,
        action: "remove",
        removedRecipeId: "minecraft:x",
        recipe,
      }).success,
    ).toBe(false);
    expect(
      recipeChangeSchema.safeParse({
        ...base,
        id: "../x",
        action: "add",
        recipe,
      }).success,
    ).toBe(false);
  });
});
