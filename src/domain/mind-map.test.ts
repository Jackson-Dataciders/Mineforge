import { describe, expect, it } from "vitest";
import type { CustomRecipeType } from "./custom-recipe";
import { defaultEntry, entrySchema, type Entry } from "./entry";
import {
  buildMindMap,
  DEFAULT_MAP_FILTERS,
  filterMindMap,
  layoutSchema,
  mindMapNodeIds,
  NODE_SIZE,
  placeUnpositioned,
  sanitizePositions,
  type MindMap,
} from "./mind-map";

const entry = (
  type: Parameters<typeof defaultEntry>[0],
  path: string,
  name: string,
  patch: Record<string, unknown> = {},
): Entry =>
  entrySchema.parse({ ...defaultEntry(type, `demo:${path}`, name), ...patch });

const melting: CustomRecipeType = {
  id: "melting",
  name: "Melting",
  machine: "demo:smelter",
  inputs: [{ type: "item" }],
  outputs: [{ type: "item", chance: false }],
  parameters: { processingTime: false, energyCost: false },
};

const plate = entry("item", "plate", "Plate");
const gear = entry("item", "gear", "Gear", {
  status: "planned",
  icon: true,
  recipes: [
    {
      type: "minecraft:crafting_shapeless",
      ingredients: [
        { item: "demo:plate" },
        [{ item: "minecraft:iron_ingot" }, { item: "minecraft:gold_ingot" }],
        { tag: "c:nuggets" },
      ],
      result: { id: "demo:gear", count: 1 },
    },
    {
      type: "custom",
      recipeType: "melting",
      inputs: [
        { type: "item", ingredient: { item: "minecraft:copper_ingot" } },
      ],
      outputs: [{ type: "item", item: "demo:gear", count: 1 }],
    },
  ],
  relations: [
    { type: "powers", target: "demo:smelter" },
    { type: "custom", target: "demo:smelter", label: "feeds" },
    { type: "drops_from", target: "demo:gone" },
  ],
});
const smelter = entry("block", "smelter", "Smelter");
const frame = entry("multiblock", "frame", "Frame", {
  dimensions: { width: 1, height: 1, depth: 2 },
  layers: [["demo:smelter", "minecraft:stone"]],
  controller: "demo:smelter",
});
const heat = entry("mechanic", "heat", "Heat", {
  involvedEntries: ["demo:smelter", "demo:gone"],
  relations: [{ type: "part_of_multiblock", target: "demo:frame" }],
});
const entries = [frame, gear, heat, plate, smelter];
const map = buildMindMap(entries, [melting]);

const edgeIds = (m: MindMap) => m.edges.map((e) => e.id).sort();

describe("buildMindMap", () => {
  it("has a node per entry and per outside ingredient", () => {
    expect(map.nodes.map((n) => `${n.kind} ${n.id}`)).toEqual([
      "entry demo:frame",
      "entry demo:gear",
      "entry demo:heat",
      "entry demo:plate",
      "entry demo:smelter",
      "item minecraft:copper_ingot",
      "item minecraft:gold_ingot",
      "item minecraft:iron_ingot",
    ]);
    expect(map.nodes[1]).toMatchObject({
      entry: { name: "Gear", type: "item", status: "planned" },
      icon: true,
    });
  });

  it("derives every edge kind and drops missing targets", () => {
    expect(edgeIds(map)).toEqual(
      [
        "custom:feeds:demo:gear->demo:smelter",
        "made_in:demo:gear->demo:smelter",
        "ingredient_of:demo:plate->demo:gear",
        "ingredient_of:minecraft:copper_ingot->demo:gear",
        "ingredient_of:minecraft:gold_ingot->demo:gear",
        "ingredient_of:minecraft:iron_ingot->demo:gear",
        "involved_in:demo:smelter->demo:heat",
        "part_of_multiblock:demo:heat->demo:frame",
        "part_of_multiblock:demo:smelter->demo:frame",
        "powers:demo:gear->demo:smelter",
      ].sort(),
    );
    const custom = map.edges.find((e) => e.kind === "custom");
    expect(custom).toMatchObject({ label: "feeds", derived: false });
    expect(map.edges.find((e) => e.kind === "made_in")?.derived).toBe(true);
  });

  it("merges a manual relation with the same derived link", () => {
    const manual = entry("block", "smelter", "Smelter", {
      relations: [{ type: "part_of_multiblock", target: "demo:frame" }],
    });
    const merged = buildMindMap([frame, manual], []);
    expect(merged.edges).toEqual([
      {
        id: "part_of_multiblock:demo:smelter->demo:frame",
        kind: "part_of_multiblock",
        source: "demo:smelter",
        target: "demo:frame",
        label: null,
        derived: false,
      },
    ]);
  });

  it("merges in either order", () => {
    // The manual relation comes from an entry listed before the multiblock.
    const manual = entry("block", "smelter", "Smelter", {
      relations: [{ type: "part_of_multiblock", target: "demo:frame" }],
    });
    const edges = buildMindMap([manual, frame], []).edges;
    expect(edges).toHaveLength(1);
    expect(edges[0]?.derived).toBe(false);
  });

  it("links a controller that is not a layer cell", () => {
    const press = entry("block", "press", "Press");
    const controlled = entry("multiblock", "tower", "Tower", {
      dimensions: { width: 1, height: 1, depth: 1 },
      layers: [["minecraft:stone"]],
      controller: "demo:press",
    });
    expect(
      buildMindMap([controlled, press], []).edges.map((e) => e.id),
    ).toEqual(["part_of_multiblock:demo:press->demo:tower"]);
  });

  it("uses only item inputs of custom recipes, without tags", () => {
    const mixer: CustomRecipeType = {
      ...melting,
      id: "mixing",
      inputs: [{ type: "item" }, { type: "item" }, { type: "fluid" }],
    };
    const paste = entry("item", "paste", "Paste", {
      recipes: [
        {
          type: "custom",
          recipeType: "mixing",
          inputs: [
            { type: "item", ingredient: { tag: "c:dusts" } },
            {
              type: "item",
              ingredient: [
                { item: "minecraft:clay_ball" },
                { item: "minecraft:snowball" },
              ],
            },
            { type: "fluid", fluid: "minecraft:water", amount: 250 },
          ],
          outputs: [{ type: "item", item: "minecraft:bone_meal", count: 1 }],
        },
      ],
    });
    expect(
      buildMindMap([paste, smelter], [mixer])
        .edges.map((e) => e.id)
        .sort(),
    ).toEqual([
      "ingredient_of:minecraft:clay_ball->demo:paste",
      "ingredient_of:minecraft:snowball->demo:paste",
      "made_in:demo:paste->demo:smelter",
    ]);
  });

  it("ignores custom recipes of unknown types for made_in", () => {
    expect(
      buildMindMap(entries, []).edges.some((e) => e.kind === "made_in"),
    ).toBe(false);
  });
});

describe("filterMindMap", () => {
  it("hides outside items by default", () => {
    const visible = filterMindMap(map, DEFAULT_MAP_FILTERS);
    expect(visible.nodes.every((n) => n.kind === "entry")).toBe(true);
    expect(visible.edges.some((e) => e.source.startsWith("minecraft:"))).toBe(
      false,
    );
    const all = filterMindMap(map, {
      ...DEFAULT_MAP_FILTERS,
      outsideItems: true,
    });
    expect(all.nodes).toHaveLength(map.nodes.length);
  });

  it("filters by type, status and edge kind", () => {
    const blocks = filterMindMap(map, {
      ...DEFAULT_MAP_FILTERS,
      types: ["item", "block"],
      statuses: ["backlog"],
    });
    expect(blocks.nodes.map((n) => n.id)).toEqual([
      "demo:plate",
      "demo:smelter",
    ]);
    expect(blocks.edges).toEqual([]);
    const onlyRecipes = filterMindMap(map, {
      ...DEFAULT_MAP_FILTERS,
      edgeKinds: ["ingredient_of"],
      outsideItems: true,
    });
    expect(new Set(onlyRecipes.edges.map((e) => e.kind))).toEqual(
      new Set(["ingredient_of"]),
    );
    // Outside items without a visible edge are hidden.
    const noGear = filterMindMap(map, {
      ...DEFAULT_MAP_FILTERS,
      statuses: ["backlog"],
      outsideItems: true,
    });
    expect(noGear.nodes.some((n) => n.kind === "item")).toBe(false);
  });
});

describe("layout", () => {
  it("validates layout.json", () => {
    expect(
      layoutSchema.parse({ positions: { "demo:gear": { x: 1, y: -2 } } }),
    ).toEqual({ positions: { "demo:gear": { x: 1, y: -2 } } });
    expect(
      layoutSchema.safeParse({ positions: { "demo:gear": { x: 1.5, y: 0 } } })
        .success,
    ).toBe(false);
  });

  it("sanitizes positions to known nodes and integers", () => {
    expect(
      sanitizePositions(
        {
          "demo:gear": { x: 10.6, y: -3.2 },
          "demo:gone": { x: 0, y: 0 },
          "demo:plate": { x: Number.NaN, y: 0 },
          "demo:frame": { x: 5e9, y: 0 },
        },
        mindMapNodeIds(map),
      ),
    ).toEqual({
      "demo:gear": { x: 11, y: -3 },
      "demo:frame": { x: 1_000_000, y: 0 },
    });
  });

  it("places unpositioned nodes in a column right of the stored ones", () => {
    const nodes = map.nodes.slice(0, 3);
    const placed = placeUnpositioned(nodes, {
      "demo:gear": { x: 100, y: 50 },
    });
    const x = 100 + NODE_SIZE.entry.width + 80;
    expect(placed).toEqual({
      "demo:gear": { x: 100, y: 50 },
      "demo:frame": { x, y: 50 },
      "demo:heat": { x, y: 50 + NODE_SIZE.entry.height + 24 },
    });
    expect(placeUnpositioned(nodes.slice(0, 1), {})).toEqual({
      "demo:frame": { x: 0, y: 0 },
    });
  });
});
