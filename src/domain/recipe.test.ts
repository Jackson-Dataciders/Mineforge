import { describe, expect, it } from "vitest";
import {
  draftToRecipe,
  emptyDraft,
  parseIngredient,
  parseVisualRecipe,
  rawRecipeToDraft,
  recipeOutputIds,
  recipeToDraft,
} from "./recipe";

// Shapes as they appear in the real vanilla 1.21.1 data.
const VANILLA_SHAPED = {
  type: "minecraft:crafting_shaped",
  category: "equipment",
  key: {
    "#": { item: "minecraft:stick" },
    X: { item: "minecraft:iron_ingot" },
  },
  pattern: ["XXX", " # ", " # "],
  result: { count: 1, id: "minecraft:iron_pickaxe" },
};

describe("parseIngredient", () => {
  it("reads items, tags and alternatives", () => {
    expect(parseIngredient({ item: "minecraft:stone" })).toEqual({
      item: "minecraft:stone",
    });
    expect(parseIngredient({ tag: "c:ingots/iron" })).toEqual({
      tag: "c:ingots/iron",
    });
    expect(
      parseIngredient([{ item: "minecraft:a" }, { tag: "minecraft:b" }]),
    ).toEqual([{ item: "minecraft:a" }, { tag: "minecraft:b" }]);
  });

  it("unwraps one-element lists and adds the minecraft namespace", () => {
    expect(parseIngredient([{ item: "stone" }])).toEqual({
      item: "minecraft:stone",
    });
  });

  it("rejects custom ingredients", () => {
    expect(
      parseIngredient({ type: "neoforge:components", items: "x" }),
    ).toBeNull();
    expect(parseIngredient({ item: "minecraft:a", count: 2 })).toBeNull();
    expect(parseIngredient([])).toBeNull();
  });
});

describe("parseVisualRecipe", () => {
  it("crafting_shaped → 9 cells, category dropped", () => {
    const recipe = parseVisualRecipe(VANILLA_SHAPED);
    expect(recipe).toEqual({
      type: "minecraft:crafting_shaped",
      pattern: [
        { item: "minecraft:iron_ingot" },
        { item: "minecraft:iron_ingot" },
        { item: "minecraft:iron_ingot" },
        null,
        { item: "minecraft:stick" },
        null,
        null,
        { item: "minecraft:stick" },
        null,
      ],
      result: { id: "minecraft:iron_pickaxe", count: 1 },
    });
  });

  it("crafting_shapeless with alternatives", () => {
    const recipe = parseVisualRecipe({
      type: "minecraft:crafting_shapeless",
      ingredients: [
        [{ item: "minecraft:black_dye" }, { item: "minecraft:blue_dye" }],
        { item: "minecraft:white_wool" },
      ],
      result: { count: 1, id: "minecraft:black_wool" },
    });
    expect(recipe?.type).toBe("minecraft:crafting_shapeless");
  });

  it("cooking: cooking result without count, experience and cookingtime", () => {
    expect(
      parseVisualRecipe({
        type: "minecraft:blasting",
        cookingtime: 100,
        experience: 0.7,
        ingredient: { tag: "c:ores/iron" },
        result: { id: "minecraft:iron_ingot" },
      }),
    ).toEqual({
      type: "minecraft:blasting",
      ingredient: { tag: "c:ores/iron" },
      result: { id: "minecraft:iron_ingot", count: 1 },
      experience: 0.7,
      cookingTime: 100,
    });
  });

  it("cooking: missing cookingtime uses the type default", () => {
    const recipe = parseVisualRecipe({
      type: "minecraft:campfire_cooking",
      ingredient: { item: "minecraft:beef" },
      result: { id: "minecraft:cooked_beef" },
    });
    expect(recipe).toMatchObject({ cookingTime: 600, experience: 0 });
  });

  it("stonecutting and smithing_transform", () => {
    expect(
      parseVisualRecipe({
        type: "minecraft:stonecutting",
        ingredient: { item: "minecraft:stone" },
        result: { count: 2, id: "minecraft:stone_slab" },
      }),
    ).toMatchObject({ result: { count: 2 } });
    expect(
      parseVisualRecipe({
        type: "minecraft:smithing_transform",
        addition: { tag: "minecraft:netherite_tool_materials" },
        base: { item: "minecraft:diamond_axe" },
        result: { count: 1, id: "minecraft:netherite_axe" },
        template: { item: "minecraft:netherite_upgrade_smithing_template" },
      }),
    ).toMatchObject({ type: "minecraft:smithing_transform" });
  });

  it("returns null for other types and unsupported content", () => {
    expect(parseVisualRecipe({ type: "minecraft:smithing_trim" })).toBeNull();
    expect(parseVisualRecipe({ type: "farmersdelight:cooking" })).toBeNull();
    expect(
      parseVisualRecipe({
        ...VANILLA_SHAPED,
        result: {
          id: "minecraft:iron_pickaxe",
          components: { "minecraft:damage": 3 },
        },
      }),
    ).toBeNull();
    expect(
      parseVisualRecipe({ ...VANILLA_SHAPED, pattern: ["XXXX"] }),
    ).toBeNull();
    expect(
      parseVisualRecipe({ ...VANILLA_SHAPED, pattern: ["XY"] }),
    ).toBeNull();
  });
});

describe("recipeOutputIds", () => {
  it("reads vanilla and common modded output shapes", () => {
    expect(recipeOutputIds(VANILLA_SHAPED)).toEqual(["minecraft:iron_pickaxe"]);
    expect(recipeOutputIds({ type: "x", result: "minecraft:stone" })).toEqual([
      "minecraft:stone",
    ]);
    expect(
      recipeOutputIds({
        type: "create:crushing",
        results: [
          { id: "create:crushed_raw_iron" },
          { item: { id: "minecraft:flint" }, chance: 0.5 },
        ],
      }).sort(),
    ).toEqual(["create:crushed_raw_iron", "minecraft:flint"]);
    expect(
      recipeOutputIds({ type: "x", output: { fluid: "minecraft:water" } }),
    ).toEqual([]);
  });
});

describe("drafts", () => {
  it("round-trips a visual recipe", () => {
    const recipe = parseVisualRecipe(VANILLA_SHAPED)!;
    expect(
      draftToRecipe(recipeToDraft(recipe), "minecraft:iron_pickaxe"),
    ).toEqual({
      ok: true,
      recipe,
    });
  });

  it("falls back to a JSON draft with the original recipe", () => {
    const raw = {
      type: "minecraft:smithing_trim",
      base: { tag: "minecraft:trimmable_armor" },
    };
    const draft = rawRecipeToDraft(raw);
    expect(draft.type).toBe("json");
    expect(draftToRecipe(draft, "minecraft:x")).toEqual({
      ok: true,
      recipe: { type: "json", data: raw },
    });
  });

  it("compacts shapeless cells and reports incomplete or invalid drafts", () => {
    const draft = emptyDraft("minecraft:crafting_shapeless");
    expect(draftToRecipe(draft, "minecraft:x")).toEqual({
      ok: false,
      error: "incomplete",
    });
    if (draft.type !== "minecraft:crafting_shapeless") throw new Error();
    draft.cells[4] = { item: "minecraft:a" };
    expect(draftToRecipe(draft, "minecraft:x")).toMatchObject({
      ok: true,
      recipe: { ingredients: [{ item: "minecraft:a" }] },
    });
    expect(draftToRecipe({ type: "json", text: "{" }, "minecraft:x")).toEqual({
      ok: false,
      error: "invalidJson",
    });
    expect(
      draftToRecipe({ type: "json", text: '{"type": ""}' }, "minecraft:x"),
    ).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("starts cooking drafts with the type's default time", () => {
    expect(emptyDraft("minecraft:smoking")).toMatchObject({ cookingTime: 100 });
  });
});
