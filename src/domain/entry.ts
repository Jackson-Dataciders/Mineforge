import { z } from "zod";
import {
  customRecipeItems,
  customRecipeSchema,
  recipeTypeIdSchema,
} from "./custom-recipe";
import { entryIdSchema } from "./entry-id";
import { resourceIdSchema } from "./library";
import {
  editableRecipeSchema,
  ingredientValues,
  JSON_RECIPE,
  recipeResult,
  type EditableRecipe,
  type Ingredient,
} from "./recipe";

/**
 * Custom mod entries (spec 04, ADR 0009, 0021): one Zod discriminated union
 * on `type`, with nested unions on `kind` and for every field that depends
 * on a choice, so invalid combinations can't be stored. These schemas are
 * the only place type-specific fields are defined (CLAUDE.md rule 9).
 */

export const ENTRY_TYPES = [
  "item",
  "block",
  "entity",
  "structure",
  "mechanic",
  "multiblock",
] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];
export const isEntryType = (v: string): v is EntryType =>
  (ENTRY_TYPES as readonly string[]).includes(v);

export const ENTRY_STATUSES = ["backlog", "planned", "implemented"] as const;
export const entryStatusSchema = z.enum(ENTRY_STATUSES);
export type EntryStatus = z.infer<typeof entryStatusSchema>;

const text = (max = 5000) => z.string().max(max).default("");
const num = (min: number, max: number) => z.number().min(min).max(max);
const int = (min: number, max: number) => z.int().min(min).max(max);
const range = (min: number, max: number) =>
  z
    .strictObject({ min: int(min, max), max: int(min, max) })
    .refine((r) => r.min <= r.max, { message: "min > max", path: ["max"] });

/** An item with count and chance (drops, loot). */
export const itemStackSchema = z.strictObject({
  item: resourceIdSchema,
  count: int(1, 99),
  chance: num(0, 1),
});
export type ItemStack = z.infer<typeof itemStackSchema>;

export const STANDARD_RELATION_TYPES = [
  "drops_from",
  "part_of_multiblock",
  "generated_in_structure",
  "powers",
] as const;
export const RELATION_TYPES = [...STANDARD_RELATION_TYPES, "custom"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const relationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.enum(STANDARD_RELATION_TYPES),
    target: entryIdSchema,
  }),
  z.strictObject({
    type: z.literal("custom"),
    target: entryIdSchema,
    label: z.string().trim().min(1).max(60),
  }),
]);
export type Relation = z.infer<typeof relationSchema>;

const tagSchema = z.string().trim().min(1).max(40);

const common = {
  id: entryIdSchema,
  /** English name (CLAUDE.md rule 6). */
  name: z.string().trim().min(1).max(100),
  description: text(),
  status: entryStatusSchema.default("backlog"),
  /** Category tags: free text. */
  tags: z
    .array(tagSchema)
    .max(20)
    .default([])
    .refine(
      (tags) => new Set(tags).size === tags.length,
      "Tags must be unique",
    ),
  /** Whether `assets/icons/<modid>/<path>.png` exists (written with the entry). */
  icon: z.boolean().default(false),
  usage: text(),
  notes: text(),
  relations: z.array(relationSchema).max(50).default([]),
};

/** Recipes on item and block entries: phase 3 recipes or custom-type recipes. */
export const entryRecipeSchema = z.union([
  editableRecipeSchema,
  customRecipeSchema,
]);
export type EntryRecipe = z.infer<typeof entryRecipeSchema>;
const recipes = z.array(entryRecipeSchema).max(30).default([]);

// --- item -----------------------------------------------------------------

export const TOOL_TIERS = [
  "wood",
  "stone",
  "iron",
  "gold",
  "diamond",
  "netherite",
] as const;
export const RARITIES = ["common", "uncommon", "rare", "epic"] as const;
export const OBTAINED_VIA = [
  "crafting",
  "drop",
  "loot",
  "trade",
  "other",
] as const;
export const ARMOR_SLOTS = ["head", "chest", "legs", "feet"] as const;
export const ITEM_KINDS = [
  "material",
  "tool",
  "weapon",
  "armor",
  "food",
  "misc",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

const durability = int(1, 100_000);
const attackDamage = num(0, 10_000);
const attackSpeed = num(0, 100);

export const foodEffectSchema = z.strictObject({
  effect: resourceIdSchema,
  durationSeconds: int(1, 100_000),
  amplifier: int(0, 255),
  chance: num(0, 1),
});

const itemBase = {
  ...common,
  type: z.literal("item"),
  stackSize: int(1, 99),
  rarity: z.enum(RARITIES),
  fireResistant: z.boolean(),
  tooltip: text(500),
  obtainedVia: z
    .array(z.enum(OBTAINED_VIA))
    .max(OBTAINED_VIA.length)
    .refine((ways) => new Set(ways).size === ways.length, "No duplicates"),
  recipes,
};

const itemSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...itemBase, kind: z.literal("material") }),
  z.strictObject({ ...itemBase, kind: z.literal("misc") }),
  z.strictObject({
    ...itemBase,
    kind: z.literal("tool"),
    tier: z.enum(TOOL_TIERS),
    durability,
    attackDamage,
    attackSpeed,
  }),
  z.strictObject({
    ...itemBase,
    kind: z.literal("weapon"),
    durability,
    attackDamage,
    attackSpeed,
  }),
  z.strictObject({
    ...itemBase,
    kind: z.literal("armor"),
    slot: z.enum(ARMOR_SLOTS),
    durability,
    defense: num(0, 1000),
    toughness: num(0, 1000),
  }),
  z.strictObject({
    ...itemBase,
    kind: z.literal("food"),
    nutrition: int(0, 1000),
    saturation: num(0, 1000),
    effects: z.array(foodEffectSchema).max(10),
  }),
]);

// --- block ----------------------------------------------------------------

export const HARVEST_TOOLS = [
  "pickaxe",
  "axe",
  "shovel",
  "hoe",
  "sword",
  "shears",
] as const;

export const harvestSchema = z.discriminatedUnion("tool", [
  z.strictObject({ tool: z.literal("none") }),
  z.strictObject({ tool: z.enum(HARVEST_TOOLS), tier: z.enum(TOOL_TIERS) }),
]);
export const guiSchema = z.discriminatedUnion("hasGui", [
  z.strictObject({ hasGui: z.literal(false) }),
  z.strictObject({ hasGui: z.literal(true), slots: text(2000) }),
]);
export const blockDropsSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("self") }),
  z.strictObject({
    type: z.literal("other"),
    items: z.array(itemStackSchema).min(1).max(20),
  }),
  z.strictObject({
    type: z.literal("loot_table"),
    lootTable: resourceIdSchema,
  }),
]);

const blockSchema = z.strictObject({
  ...common,
  type: z.literal("block"),
  hardness: num(-1, 1_000_000),
  blastResistance: num(0, 1_000_000),
  harvest: harvestSchema,
  lightLevel: int(0, 15),
  fullCube: z.boolean(),
  transparent: z.boolean(),
  hasBlockEntity: z.boolean(),
  gui: guiSchema,
  drops: blockDropsSchema,
  redstone: text(2000),
  variants: text(2000),
  hasBlockItem: z.boolean(),
  recipes,
});

// --- entity ---------------------------------------------------------------

export const ENTITY_KINDS = [
  "hostile",
  "neutral",
  "passive",
  "boss",
  "projectile",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];
/** Vanilla BossEvent colors and overlays (1.21.1). */
export const BOSS_BAR_COLORS = [
  "pink",
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
  "white",
] as const;
export const BOSS_BAR_OVERLAYS = [
  "progress",
  "notched_6",
  "notched_10",
  "notched_12",
  "notched_20",
] as const;

export const spawnSchema = z.strictObject({
  dimensions: z.array(resourceIdSchema).max(20),
  biomes: z.array(resourceIdSchema).max(100),
  lightLevel: range(0, 15),
  groupSize: range(1, 100),
});

const entityBase = {
  ...common,
  type: z.literal("entity"),
  health: num(0, 1_000_000),
  armor: num(0, 1000),
  attackDamage,
  movementSpeed: num(0, 100),
  size: z.strictObject({ width: num(0.05, 64), height: num(0.05, 64) }),
  drops: z.array(itemStackSchema).max(20),
  behavior: text(),
};

const entitySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...entityBase,
    kind: z.literal("hostile"),
    spawn: spawnSchema,
  }),
  z.strictObject({
    ...entityBase,
    kind: z.literal("neutral"),
    spawn: spawnSchema,
  }),
  z.strictObject({
    ...entityBase,
    kind: z.literal("passive"),
    spawn: spawnSchema,
  }),
  z.strictObject({
    ...entityBase,
    kind: z.literal("boss"),
    spawn: spawnSchema,
    bossBar: z.strictObject({
      color: z.enum(BOSS_BAR_COLORS),
      overlay: z.enum(BOSS_BAR_OVERLAYS),
    }),
  }),
  z.strictObject({ ...entityBase, kind: z.literal("projectile") }),
]);

// --- structure, mechanic, multiblock ---------------------------------------

const structureSchema = z.strictObject({
  ...common,
  type: z.literal("structure"),
  dimension: resourceIdSchema,
  biomes: z.array(resourceIdSchema).max(100),
  placement: z
    .strictObject({ spacing: int(1, 4096), separation: int(0, 4095) })
    .refine((p) => p.separation < p.spacing, {
      message: "Separation must be smaller than spacing",
      path: ["separation"],
    }),
  size: z.strictObject({ x: int(1, 512), y: int(1, 512), z: int(1, 512) }),
  keyBlocks: z.array(resourceIdSchema).max(30),
  mobs: z.array(resourceIdSchema).max(30),
  loot: z.array(itemStackSchema).max(30),
});

export const MECHANIC_CATEGORIES = [
  "resource_system",
  "progression",
  "effect",
  "enchantment",
  "worldgen",
  "other",
] as const;

const mechanicSchema = z.strictObject({
  ...common,
  type: z.literal("mechanic"),
  category: z.enum(MECHANIC_CATEGORIES),
  howItWorks: text(),
  parameters: text(),
  involvedEntries: z.array(entryIdSchema).max(50),
});

export const MAX_MULTIBLOCK_SIZE = 16;

const multiblockSchema = z
  .strictObject({
    ...common,
    type: z.literal("multiblock"),
    dimensions: z.strictObject({
      width: int(1, MAX_MULTIBLOCK_SIZE),
      height: int(1, MAX_MULTIBLOCK_SIZE),
      depth: int(1, MAX_MULTIBLOCK_SIZE),
    }),
    /** One array per layer (bottom first), `width × depth` cells row by row. */
    layers: z.array(z.array(resourceIdSchema.nullable())),
    controller: resourceIdSchema.nullable(),
    formationTrigger: text(2000),
    function: text(),
    inputsOutputs: text(),
    recipeTypes: z.array(recipeTypeIdSchema).max(20),
  })
  .refine(
    (m) =>
      m.layers.length === m.dimensions.height &&
      m.layers.every(
        (l) => l.length === m.dimensions.width * m.dimensions.depth,
      ),
    { message: "Layers don't match the dimensions", path: ["layers"] },
  );

// --- the union --------------------------------------------------------------

export const entrySchema = z
  .discriminatedUnion("type", [
    itemSchema,
    blockSchema,
    entitySchema,
    structureSchema,
    mechanicSchema,
    multiblockSchema,
  ])
  .superRefine((entry, ctx) => {
    if (!isItemEntry(entry)) return;
    entry.recipes.forEach((recipe, i) => {
      if (recipe.type === "custom") return;
      const result = recipeResult(recipe);
      if (result && result.id !== entry.id) {
        ctx.addIssue({
          code: "custom",
          message: "A recipe's result must be the entry",
          path: ["recipes", i, "result", "id"],
        });
      }
    });
  });
export type Entry = z.infer<typeof entrySchema>;
export type EntryInput = z.input<typeof entrySchema>;
export type ItemEntry = Extract<Entry, { type: "item" }>;
export type BlockEntry = Extract<Entry, { type: "block" }>;
export type EntityEntry = Extract<Entry, { type: "entity" }>;
export type MultiblockEntry = Extract<Entry, { type: "multiblock" }>;

/** Only item and block entries are items in the game (ADR 0021). */
export const isItemEntry = (entry: Entry): entry is ItemEntry | BlockEntry =>
  entry.type === "item" || entry.type === "block";

// ---------------------------------------------------------------------------
// Defaults and kind switching

const COMMON_DEFAULTS = {
  description: "",
  status: "backlog" as EntryStatus,
  tags: [] as string[],
  icon: false,
  usage: "",
  notes: "",
  relations: [] as Relation[],
};

/** Fields each kind adds, with their defaults. */
export const KIND_FIELDS = {
  item: {
    material: {},
    misc: {},
    tool: { tier: "iron", durability: 250, attackDamage: 1, attackSpeed: 1.2 },
    weapon: { durability: 250, attackDamage: 6, attackSpeed: 1.6 },
    armor: { slot: "chest", durability: 240, defense: 6, toughness: 0 },
    food: { nutrition: 4, saturation: 2.4, effects: [] },
  },
  entity: {
    hostile: { spawn: "spawn" },
    neutral: { spawn: "spawn" },
    passive: { spawn: "spawn" },
    boss: { spawn: "spawn", bossBar: { color: "purple", overlay: "progress" } },
    projectile: {},
  },
} as const;

const defaultSpawn = () => ({
  dimensions: ["minecraft:overworld"],
  biomes: [],
  lightLevel: { min: 0, max: 15 },
  groupSize: { min: 1, max: 4 },
});

function kindFields(
  type: "item" | "entity",
  kind: string,
): Record<string, unknown> {
  const fields =
    (KIND_FIELDS[type] as Record<string, Record<string, unknown>>)[kind] ?? {};
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      value === "spawn" ? defaultSpawn() : structuredClone(value),
    ]),
  );
}

/** A new entry of a type with sensible defaults (backlog, no icon). */
export function defaultEntry(type: EntryType, id: string, name: string): Entry {
  const base = { ...structuredClone(COMMON_DEFAULTS), id, name };
  let entry: unknown;
  switch (type) {
    case "item":
      entry = {
        ...base,
        type,
        kind: "material",
        stackSize: 64,
        rarity: "common",
        fireResistant: false,
        tooltip: "",
        obtainedVia: [],
        recipes: [],
      };
      break;
    case "block":
      entry = {
        ...base,
        type,
        hardness: 1.5,
        blastResistance: 6,
        harvest: { tool: "pickaxe", tier: "wood" },
        lightLevel: 0,
        fullCube: true,
        transparent: false,
        hasBlockEntity: false,
        gui: { hasGui: false },
        drops: { type: "self" },
        redstone: "",
        variants: "",
        hasBlockItem: true,
        recipes: [],
      };
      break;
    case "entity":
      entry = {
        ...base,
        type,
        kind: "passive",
        health: 10,
        armor: 0,
        attackDamage: 0,
        movementSpeed: 0.25,
        size: { width: 0.6, height: 1.8 },
        drops: [],
        behavior: "",
        ...kindFields("entity", "passive"),
      };
      break;
    case "structure":
      entry = {
        ...base,
        type,
        dimension: "minecraft:overworld",
        biomes: [],
        placement: { spacing: 32, separation: 8 },
        size: { x: 16, y: 16, z: 16 },
        keyBlocks: [],
        mobs: [],
        loot: [],
      };
      break;
    case "mechanic":
      entry = {
        ...base,
        type,
        category: "other",
        howItWorks: "",
        parameters: "",
        involvedEntries: [],
      };
      break;
    case "multiblock":
      entry = {
        ...base,
        type,
        dimensions: { width: 3, height: 3, depth: 3 },
        layers: Array.from({ length: 3 }, () => Array<null>(9).fill(null)),
        controller: null,
        formationTrigger: "",
        function: "",
        inputsOutputs: "",
        recipeTypes: [],
      };
      break;
  }
  return entrySchema.parse(entry);
}

/**
 * Switches an item's or entity's kind. Fields the new kind shares with the
 * old one keep their values; fields only the old kind had are dropped and
 * listed in `lost` if they differ from their defaults (so the form can ask
 * before clearing them).
 */
export function switchKind<
  E extends Extract<Entry, { type: "item" | "entity" }>,
>(entry: E, kind: string): { entry: E; lost: string[] } {
  const type = entry.type;
  const oldFields = kindFields(type, entry.kind);
  const newFields = kindFields(type, kind);
  const record = entry as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record, kind };
  const lost: string[] = [];
  for (const key of Object.keys(oldFields)) {
    if (key in newFields) continue;
    delete next[key];
    if (JSON.stringify(record[key]) !== JSON.stringify(oldFields[key])) {
      lost.push(key);
    }
  }
  for (const [key, value] of Object.entries(newFields)) {
    if (!(key in oldFields)) next[key] = value;
  }
  // Not validated here: the form may still hold incomplete values (e.g. an
  // empty ID while creating); the schema checks the entry on save.
  return { entry: next as E, lost };
}

// ---------------------------------------------------------------------------
// Multiblock layout

/** Resizes a layout, keeping cells that still fit. */
export function resizeLayers(
  layers: readonly (readonly (string | null)[])[],
  from: { width: number; depth: number },
  to: { width: number; height: number; depth: number },
): (string | null)[][] {
  return Array.from({ length: to.height }, (_, y) =>
    Array.from({ length: to.width * to.depth }, (_, i) => {
      const x = i % to.width;
      const z = Math.floor(i / to.width);
      if (x >= from.width || z >= from.depth) return null;
      return layers[y]?.[z * from.width + x] ?? null;
    }),
  );
}

// ---------------------------------------------------------------------------
// References

const ingredientItems = (ingredient: Ingredient): string[] =>
  ingredientValues(ingredient).flatMap((v) => ("item" in v ? [v.item] : []));

function recipeItems(recipe: EntryRecipe): string[] {
  if (recipe.type === "custom") return customRecipeItems(recipe);
  if (recipe.type === JSON_RECIPE) return [];
  const visual = recipe as Exclude<EditableRecipe, { type: "json" }>;
  const cells: (Ingredient | null)[] =
    "pattern" in visual
      ? visual.pattern
      : "ingredients" in visual
        ? visual.ingredients
        : "template" in visual
          ? [visual.template, visual.base, visual.addition]
          : [visual.ingredient];
  return cells.flatMap((c) => (c ? ingredientItems(c) : []));
}

/** Entry IDs this entry links to through relations or involved entries. */
export function linkedEntryIds(entry: Entry): string[] {
  const ids = entry.relations.map((r) => r.target);
  if (entry.type === "mechanic") ids.push(...entry.involvedEntries);
  return [...new Set(ids)];
}

/** Item IDs this entry uses: recipe ingredients, drops, blocks, loot. */
export function usedItemIds(entry: Entry): string[] {
  const ids: string[] = [];
  switch (entry.type) {
    case "item":
      entry.recipes.forEach((r) => ids.push(...recipeItems(r)));
      break;
    case "block":
      entry.recipes.forEach((r) => ids.push(...recipeItems(r)));
      if (entry.drops.type === "other")
        ids.push(...entry.drops.items.map((d) => d.item));
      break;
    case "entity":
      ids.push(...entry.drops.map((d) => d.item));
      break;
    case "structure":
      ids.push(...entry.keyBlocks, ...entry.loot.map((l) => l.item));
      break;
    case "multiblock":
      entry.layers.forEach((layer) =>
        layer.forEach((cell) => cell && ids.push(cell)),
      );
      if (entry.controller) ids.push(entry.controller);
      break;
    case "mechanic":
      break;
  }
  return [...new Set(ids)];
}

/** Custom recipe type IDs this entry uses (recipes, multiblock types). */
export function usedRecipeTypes(entry: Entry): string[] {
  const ids: string[] = [];
  if (isItemEntry(entry)) {
    for (const r of entry.recipes)
      if (r.type === "custom") ids.push(r.recipeType);
  }
  if (entry.type === "multiblock") ids.push(...entry.recipeTypes);
  return [...new Set(ids)];
}

/** Whether `entry` references `targetId` in any way. */
export const referencesEntry = (entry: Entry, targetId: string) =>
  entry.id !== targetId &&
  (linkedEntryIds(entry).includes(targetId) ||
    usedItemIds(entry).includes(targetId));

/** The entry without manual relations to `targetId` (used when it's deleted). */
export function withoutRelationsTo<E extends Entry>(
  entry: E,
  targetId: string,
): E {
  return {
    ...entry,
    relations: entry.relations.filter((r) => r.target !== targetId),
  };
}

/**
 * The entry with a new ID (only while creating, before the ID is fixed).
 * Visual recipe results follow, since they must be the entry.
 */
export function withEntryId<E extends Entry>(entry: E, id: string): E {
  if (!isItemEntry(entry)) return { ...entry, id };
  return {
    ...entry,
    id,
    recipes: entry.recipes.map((recipe) => {
      if (recipe.type === JSON_RECIPE) return recipe;
      if (recipe.type === "custom") {
        return {
          ...recipe,
          outputs: recipe.outputs.map((out) =>
            out.type === "item" && out.item === entry.id
              ? { ...out, item: id }
              : out,
          ),
        };
      }
      return { ...recipe, result: { ...recipe.result, id } };
    }),
  } as E;
}
