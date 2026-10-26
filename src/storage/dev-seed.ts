import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { devSeedDir } from "@/server/dev-fake";
import { defaultEntry, entrySchema } from "@/domain/entry";
import { encodeJson } from "@/lib/stable-json";
import { MemoryBackend } from "./memory-backend";

// A 16×16 sample PNG so the texture route has something to serve.
const SAMPLE_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPElEQVR4nGPQiHL7TwlmABFuq6bBccWdEyh8fGIYBpCiGUSjGECqZhQDyNGM4QJywmE0EEcDkbqBSAkGAJMqcAdBT/wZAAAAAElFTkSuQmCC",
  ),
  (c) => c.charCodeAt(0),
);

const item = (id: string, name: string, icon: string | null = null) => ({
  id,
  name,
  icon,
  source: "extracted",
});
const recipe = (id: string, data: Record<string, unknown>) => ({
  id,
  type: data.type as string,
  source: "extracted",
  data,
});
const ing = (id: string) => ({ item: id });

/** A small vanilla subset with one recipe of each editor type. */
const VANILLA_ITEMS = [
  item("minecraft:beef", "Raw Beef"),
  item("minecraft:black_dye", "Black Dye"),
  item("minecraft:black_wool", "Black Wool"),
  item("minecraft:blue_dye", "Blue Dye"),
  item("minecraft:brick", "Brick"),
  item("minecraft:cobblestone", "Cobblestone"),
  item("minecraft:cooked_beef", "Steak"),
  item("minecraft:decorated_pot", "Decorated Pot"),
  item("minecraft:diamond_sword", "Diamond Sword"),
  item("minecraft:iron_ingot", "Iron Ingot", "minecraft/item/sample.png"),
  item("minecraft:iron_pickaxe", "Iron Pickaxe", "minecraft/item/sample.png"),
  item("minecraft:netherite_ingot", "Netherite Ingot"),
  item("minecraft:netherite_sword", "Netherite Sword"),
  item(
    "minecraft:netherite_upgrade_smithing_template",
    "Netherite Upgrade Smithing Template",
  ),
  item("minecraft:oak_planks", "Oak Planks"),
  item("minecraft:raw_iron", "Raw Iron"),
  item("minecraft:stick", "Stick", "minecraft/item/sample.png"),
  item("minecraft:stone", "Stone"),
  item("minecraft:stone_slab", "Stone Slab"),
  item("minecraft:white_wool", "White Wool"),
];

const VANILLA_RECIPES = [
  recipe("minecraft:iron_pickaxe", {
    type: "minecraft:crafting_shaped",
    category: "equipment",
    key: { "#": ing("minecraft:stick"), X: ing("minecraft:iron_ingot") },
    pattern: ["XXX", " # ", " # "],
    result: { count: 1, id: "minecraft:iron_pickaxe" },
  }),
  recipe("minecraft:dye_black_wool", {
    type: "minecraft:crafting_shapeless",
    category: "building",
    ingredients: [
      ing("minecraft:black_dye"),
      [ing("minecraft:white_wool"), ing("minecraft:blue_dye")],
    ],
    result: { count: 1, id: "minecraft:black_wool" },
  }),
  recipe("minecraft:iron_ingot_from_smelting_raw_iron", {
    type: "minecraft:smelting",
    category: "misc",
    cookingtime: 200,
    experience: 0.7,
    ingredient: ing("minecraft:raw_iron"),
    result: { id: "minecraft:iron_ingot" },
  }),
  recipe("minecraft:iron_ingot_from_blasting_raw_iron", {
    type: "minecraft:blasting",
    category: "misc",
    cookingtime: 100,
    experience: 0.7,
    ingredient: ing("minecraft:raw_iron"),
    result: { id: "minecraft:iron_ingot" },
  }),
  recipe("minecraft:cooked_beef_from_smoking", {
    type: "minecraft:smoking",
    category: "food",
    cookingtime: 100,
    experience: 0.35,
    ingredient: ing("minecraft:beef"),
    result: { id: "minecraft:cooked_beef" },
  }),
  recipe("minecraft:cooked_beef_from_campfire_cooking", {
    type: "minecraft:campfire_cooking",
    category: "food",
    cookingtime: 600,
    experience: 0.35,
    ingredient: ing("minecraft:beef"),
    result: { id: "minecraft:cooked_beef" },
  }),
  recipe("minecraft:stone_slab_from_stone_stonecutting", {
    type: "minecraft:stonecutting",
    ingredient: ing("minecraft:stone"),
    result: { count: 2, id: "minecraft:stone_slab" },
  }),
  recipe("minecraft:netherite_sword_smithing", {
    type: "minecraft:smithing_transform",
    addition: { tag: "minecraft:netherite_tool_materials" },
    base: ing("minecraft:diamond_sword"),
    result: { count: 1, id: "minecraft:netherite_sword" },
    template: ing("minecraft:netherite_upgrade_smithing_template"),
  }),
  recipe("minecraft:decorated_pot", {
    type: "minecraft:crafting_decorated_pot",
    category: "misc",
    result: { id: "minecraft:decorated_pot" },
  }),
];

const VANILLA_TAGS = {
  "c:ingots/iron": { replace: false, values: ["minecraft:iron_ingot"] },
  "c:rods/wooden": { replace: false, values: ["minecraft:stick"] },
  "minecraft:netherite_tool_materials": {
    replace: false,
    values: ["minecraft:netherite_ingot"],
  },
  "minecraft:planks": { replace: false, values: ["minecraft:oak_planks"] },
};

const meta = (modId: string, extra: object) => ({
  modId,
  version: "1.0.0",
  loader: "neoforge",
  minecraftVersionRange: "[1.21.1,1.22)",
  modIds: [modId],
  jarFile: `jars/mods/${modId}-1.0.0.jar`,
  jarSha256: "0".repeat(64),
  dependencies: [],
  logo: null,
  ...extra,
});

/** Fixture data: vanilla subset, a NeoForge mod with a missing dependency, a Fabric mod, a pending jar. */
function fixtureFiles(): Record<string, Uint8Array> {
  return {
    "data/vanilla/1.21.1/items.json": encodeJson(VANILLA_ITEMS),
    "data/vanilla/1.21.1/recipes.json": encodeJson(VANILLA_RECIPES),
    "data/vanilla/1.21.1/tags.json": encodeJson(VANILLA_TAGS),
    "data/library/alpha_tech/meta.json": encodeJson(
      meta("alpha_tech", {
        name: "Alpha Tech",
        dependencies: [
          { modId: "beta_core", type: "required", versionRange: "[2,)" },
          {
            modId: "minecraft",
            type: "required",
            versionRange: "[1.21.1,1.22)",
          },
          { modId: "neoforge", type: "required", versionRange: "[21.1,)" },
        ],
        logo: "alpha_tech/_logo.png",
      }),
    ),
    "data/library/alpha_tech/items.json": encodeJson([
      item("alpha_tech:gear", "Iron Gear", "minecraft/item/sample.png"),
      {
        ...item("alpha_tech:press", "Press"),
        source: "inferred",
        evidence: "AlphaItems.register (PRESS)",
      },
    ]),
    "data/library/alpha_tech/recipes.json": encodeJson([
      recipe("alpha_tech:gear", {
        type: "minecraft:crafting_shaped",
        key: { I: { tag: "c:ingots/iron" } },
        pattern: [" I ", "I I", " I "],
        result: { count: 2, id: "alpha_tech:gear" },
      }),
      recipe("alpha_tech:pressing/iron_sheet", {
        type: "alpha_tech:pressing",
        ingredient: ing("minecraft:iron_ingot"),
        result: { id: "alpha_tech:gear", count: 1 },
      }),
    ]),
    "data/library/alpha_tech/tags.json": encodeJson({
      "c:gears/iron": { replace: false, values: ["alpha_tech:gear"] },
    }),
    "data/library/fab-mod/meta.json": encodeJson(
      meta("fab-mod", {
        name: "Fab Mod",
        loader: "fabric",
        minecraftVersionRange: "~1.21",
        jarFile: "jars/mods/fab-mod-1.0.0.jar",
      }),
    ),
    "data/library/fab-mod/items.json": encodeJson([
      item("fab-mod:widget", "Widget"),
    ]),
    "jars/mods/alpha_tech-1.0.0.jar": new TextEncoder().encode("jar"),
    "jars/mods/fab-mod-1.0.0.jar": new TextEncoder().encode("jar"),
    "jars/mods/pending_mod-3.2.jar": new TextEncoder().encode("jar"),
    "assets/textures/minecraft/item/sample.png": SAMPLE_PNG,
    "assets/textures/alpha_tech/_logo.png": SAMPLE_PNG,
  };
}

/**
 * Files below `<dir>/data/{vanilla,library}` and `<dir>/assets/textures`.
 * Dev only: the ignore comments keep Turbopack from tracing the whole
 * project (data, jars) into the server bundle because of these dynamic paths.
 */
function folderFiles(dir: string): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  for (const sub of ["data/vanilla", "data/library", "assets/textures"]) {
    const root = path.join(/*turbopackIgnore: true*/ dir, sub);
    let entries: string[];
    try {
      entries = readdirSync(/*turbopackIgnore: true*/ root, {
        recursive: true,
        encoding: "utf8",
      });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(/*turbopackIgnore: true*/ root, entry);
      try {
        files[`${sub}/${entry.split(path.sep).join("/")}`] = new Uint8Array(
          readFileSync(/*turbopackIgnore: true*/ full),
        );
      } catch {
        // Directories can't be read as files; skip them.
      }
    }
  }
  return files;
}

/** A few entries of the example custom mod (spec 04). */
function exampleEntries(): Record<string, Uint8Array> {
  const entry = (value: Record<string, unknown>) => {
    const parsed = entrySchema.parse(value);
    const path = parsed.id.split(":")[1]!;
    return [
      `data/custom-mods/example_mod/entries/${path}.json`,
      encodeJson(parsed),
    ] as const;
  };
  return Object.fromEntries([
    entry({
      ...defaultEntry("item", "example_mod:copper_gear", "Copper Gear"),
      status: "planned",
      icon: true,
      tags: ["machine parts"],
      recipes: [
        {
          type: "minecraft:crafting_shaped",
          pattern: [
            null,
            { item: "minecraft:iron_ingot" },
            null,
            { item: "minecraft:iron_ingot" },
            { tag: "c:rods/wooden" },
            { item: "minecraft:iron_ingot" },
            null,
            { item: "minecraft:iron_ingot" },
            null,
          ],
          result: { id: "example_mod:copper_gear", count: 1 },
        },
      ],
    }),
    entry({
      ...defaultEntry("block", "example_mod:smelter", "Smelter"),
      hasBlockEntity: true,
      gui: { hasGui: true, slots: "1 input, 1 fuel, 1 output" },
    }),
    entry({
      ...defaultEntry("mechanic", "example_mod:heat", "Heat"),
      involvedEntries: ["example_mod:smelter"],
      relations: [{ type: "powers", target: "example_mod:smelter" }],
    }),
  ]);
}

const globalStore = globalThis as { __mineforgeDevStorage?: MemoryBackend };

/**
 * The in-memory backend for dev fake mode (ADR 0014), kept on `globalThis` so
 * it survives hot reloads. Data is lost when the dev server stops. With
 * `MINEFORGE_DEV_SEED_DIR`, library and vanilla data come from that folder.
 */
export function devMemoryBackend(): MemoryBackend {
  if (!globalStore.__mineforgeDevStorage) {
    const seedDir = devSeedDir();
    globalStore.__mineforgeDevStorage = new MemoryBackend({
      "data/custom-mods/example_mod/mod.json": encodeJson({
        modId: "example_mod",
        name: "Example Mod",
        phase: "planning",
        dependencies: ["gamma_lib"],
        recipeTypes: [
          {
            id: "melting",
            name: "Melting",
            machine: "example_mod:smelter",
            inputs: [{ type: "item" }, { type: "energy" }],
            outputs: [
              { type: "fluid", chance: false },
              { type: "item", chance: true },
            ],
            parameters: { processingTime: true, energyCost: false },
          },
        ],
      }),
      // The Copper Gear's icon (sample PNG).
      "assets/icons/example_mod/copper_gear.png": SAMPLE_PNG,
      "data/modpacks/starter-pack/pack.json": encodeJson({
        id: "starter-pack",
        name: "Starter Pack",
        libraryModIds: [],
        customModIds: ["example_mod"],
      }),
      ...exampleEntries(),
      ...(seedDir ? folderFiles(seedDir) : fixtureFiles()),
    });
  }
  return globalStore.__mineforgeDevStorage;
}
