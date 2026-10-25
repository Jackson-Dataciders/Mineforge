import { describe, expect, it } from "vitest";
import { generateKubeJsScript, scriptFileName, shapedPattern } from "./kubejs";
import type { EditableRecipe } from "./recipe";
import { recipeChangeSchema, type RecipeChange } from "./recipe-change";

const PACK = "my-pack";

function change(
  partial: Partial<RecipeChange> & { recipe?: EditableRecipe },
): RecipeChange {
  return recipeChangeSchema.parse({
    id: "thing",
    item: "minecraft:thing",
    itemName: "Thing",
    action: "add",
    ...partial,
  });
}

/** Script body between the header and the closing line. */
function body(script: string): string {
  const lines = script.split("\n");
  const start = lines.indexOf("ServerEvents.recipes(event => {");
  return lines.slice(start + 1, lines.lastIndexOf("})")).join("\n");
}

const result = (id = "minecraft:thing", count = 1) => ({ id, count });

describe("generateKubeJsScript", () => {
  it("writes a header and one ServerEvents.recipes block", () => {
    const script = generateKubeJsScript(
      PACK,
      change({
        recipe: {
          type: "minecraft:stonecutting",
          ingredient: { item: "minecraft:stone" },
          result: result(),
        },
      }),
    );
    expect(script).toBe(
      [
        '// Mineforge modpack "my-pack", recipe change "thing".',
        "// Adds a recipe for Thing (minecraft:thing).",
        "// Place this file in kubejs/server_scripts/.",
        "",
        "ServerEvents.recipes(event => {",
        '  event.stonecutting("minecraft:thing", "minecraft:stone").id("my-pack:thing")',
        "})",
        "",
      ].join("\n"),
    );
  });

  it("crafting_shaped: trims the grid, keys in reading order, tags and alternatives", () => {
    const iron = { item: "minecraft:iron_ingot" };
    const stick = { tag: "c:rods/wooden" };
    const planks = [
      { item: "minecraft:oak_planks" },
      { tag: "minecraft:planks" },
    ];
    const script = generateKubeJsScript(
      PACK,
      change({
        id: "iron_pickaxe",
        item: "minecraft:iron_pickaxe",
        itemName: "Iron Pickaxe",
        action: "replace",
        replacedRecipeId: "minecraft:iron_pickaxe",
        recipe: {
          type: "minecraft:crafting_shaped",
          // Column 0 is empty and gets trimmed; the middle cell of row 2 stays a space.
          pattern: [null, iron, iron, null, stick, planks, null, stick, null],
          result: result("minecraft:iron_pickaxe"),
        },
      }),
    );
    expect(body(script)).toBe(
      [
        '  event.remove({ id: "minecraft:iron_pickaxe" })',
        '  event.shaped("minecraft:iron_pickaxe", [',
        '    "AA",',
        '    "BC",',
        '    "B ",',
        "  ], {",
        '    A: "minecraft:iron_ingot",',
        '    B: "#c:rods/wooden",',
        '    C: ["minecraft:oak_planks", "#minecraft:planks"],',
        '  }).id("my-pack:iron_pickaxe")',
      ].join("\n"),
    );
    expect(script).toContain(
      "// Replaces minecraft:iron_pickaxe for Iron Pickaxe (minecraft:iron_pickaxe).",
    );
  });

  it("crafting_shapeless with a result count", () => {
    const script = generateKubeJsScript(
      PACK,
      change({
        recipe: {
          type: "minecraft:crafting_shapeless",
          ingredients: [
            { item: "minecraft:stone" },
            { item: "minecraft:stone" },
            { tag: "c:dyes/red" },
          ],
          result: result("minecraft:thing", 4),
        },
      }),
    );
    expect(body(script)).toBe(
      [
        '  event.shapeless("4x minecraft:thing", [',
        '    "minecraft:stone",',
        '    "minecraft:stone",',
        '    "#c:dyes/red",',
        '  ]).id("my-pack:thing")',
      ].join("\n"),
    );
  });

  it.each([
    ["minecraft:smelting", "smelting", 200],
    ["minecraft:blasting", "blasting", 100],
    ["minecraft:smoking", "smoking", 100],
    ["minecraft:campfire_cooking", "campfireCooking", 600],
  ] as const)("%s → event.%s with xp and cooking time", (type, fn, time) => {
    const script = generateKubeJsScript(
      PACK,
      change({
        recipe: {
          type,
          ingredient: { item: "minecraft:raw_thing" },
          result: result(),
          experience: 0.35,
          cookingTime: time,
        },
      }),
    );
    expect(body(script)).toBe(
      `  event.${fn}("minecraft:thing", "minecraft:raw_thing").xp(0.35).cookingTime(${time}).id("my-pack:thing")`,
    );
  });

  it("stonecutting with a count", () => {
    const script = generateKubeJsScript(
      PACK,
      change({
        recipe: {
          type: "minecraft:stonecutting",
          ingredient: { tag: "c:stones" },
          result: result("minecraft:thing", 2),
        },
      }),
    );
    expect(body(script)).toBe(
      '  event.stonecutting("2x minecraft:thing", "#c:stones").id("my-pack:thing")',
    );
  });

  it("smithing_transform → event.smithing(result, template, base, addition)", () => {
    const script = generateKubeJsScript(
      PACK,
      change({
        item: "minecraft:netherite_sword",
        recipe: {
          type: "minecraft:smithing_transform",
          template: { item: "minecraft:netherite_upgrade_smithing_template" },
          base: { item: "minecraft:diamond_sword" },
          addition: { tag: "c:ingots/netherite" },
          result: result("minecraft:netherite_sword"),
        },
      }),
    );
    expect(body(script)).toBe(
      '  event.smithing("minecraft:netherite_sword", "minecraft:netherite_upgrade_smithing_template", "minecraft:diamond_sword", "#c:ingots/netherite").id("my-pack:thing")',
    );
  });

  it("JSON recipes → event.custom with sorted keys", () => {
    const script = generateKubeJsScript(
      PACK,
      change({
        id: "tomato_sauce",
        item: "farmersdelight:tomato_sauce",
        action: "replace",
        replacedRecipeId: "farmersdelight:cooking/tomato_sauce",
        recipe: {
          type: "json",
          data: {
            type: "farmersdelight:cooking",
            result: { id: "farmersdelight:tomato_sauce" },
            cookingtime: 200,
            ingredients: [{ tag: "c:crops/tomato" }],
          },
        },
      }),
    );
    expect(body(script)).toBe(
      [
        '  event.remove({ id: "farmersdelight:cooking/tomato_sauce" })',
        "  event.custom({",
        '    "cookingtime": 200,',
        '    "ingredients": [',
        "      {",
        '        "tag": "c:crops/tomato"',
        "      }",
        "    ],",
        '    "result": {',
        '      "id": "farmersdelight:tomato_sauce"',
        "    },",
        '    "type": "farmersdelight:cooking"',
        '  }).id("my-pack:tomato_sauce")',
      ].join("\n"),
    );
  });

  it("remove-only changes emit only event.remove", () => {
    const script = generateKubeJsScript(
      PACK,
      change({
        action: "remove",
        removedRecipeId: "minecraft:thing_from_stone",
      }),
    );
    expect(body(script)).toBe(
      '  event.remove({ id: "minecraft:thing_from_stone" })',
    );
    expect(script).toContain(
      "// Removes minecraft:thing_from_stone for Thing (minecraft:thing).",
    );
  });

  it("keeps item names on one comment line", () => {
    const script = generateKubeJsScript(
      PACK,
      change({
        itemName: "Evil\nevent.remove({})",
        action: "remove",
        removedRecipeId: "minecraft:a",
      }),
    );
    expect(script.split("\n")[1]).toBe(
      "// Removes minecraft:a for Evil event.remove({}) (minecraft:thing).",
    );
  });

  it("is deterministic", () => {
    const c = change({
      recipe: {
        type: "minecraft:crafting_shapeless",
        ingredients: [{ item: "minecraft:a" }],
        result: result(),
      },
    });
    expect(generateKubeJsScript(PACK, c)).toBe(generateKubeJsScript(PACK, c));
  });
});

describe("shapedPattern", () => {
  it("reuses a key for identical ingredients and keeps interior gaps", () => {
    const a = { item: "minecraft:a" };
    const { rows, key } = shapedPattern([
      a,
      null,
      a,
      null,
      null,
      null,
      a,
      null,
      a,
    ]);
    expect(rows).toEqual(["A A", "   ", "A A"]);
    expect(key).toEqual([["A", a]]);
  });

  it("trims a single cell to one row", () => {
    const b = { tag: "c:b" };
    expect(
      shapedPattern([null, null, null, null, null, null, null, null, b]).rows,
    ).toEqual(["A"]);
  });
});

describe("scriptFileName", () => {
  it("is derived from pack ID and change ID", () => {
    expect(scriptFileName("my-pack", "iron_pickaxe")).toBe(
      "my-pack-iron_pickaxe.js",
    );
  });
});
