import { describe, expect, it } from "vitest";
import {
  defaultEntry,
  ENTITY_KINDS,
  ITEM_KINDS,
  ENTRY_TYPES,
  entrySchema,
  isItemEntry,
  linkedEntryIds,
  referencesEntry,
  resizeLayers,
  switchKind,
  usedItemIds,
  usedRecipeTypes,
  withoutRelationsTo,
  withEntryId,
  type Entry,
} from "./entry";
import { isEntryId, suggestEntryPath } from "./entry-id";

const ID = "my_mod:thing";
const parse = (value: unknown) => entrySchema.safeParse(value);
const withFields = (entry: Entry, fields: Record<string, unknown>) => ({
  ...entry,
  ...fields,
});

describe("entry IDs", () => {
  it("suggests snake_case paths from English names", () => {
    expect(suggestEntryPath("Iron Gear")).toBe("iron_gear");
    expect(suggestEntryPath("Größe Äxte!")).toBe("grosse_axte");
    expect(suggestEntryPath("1st Thing")).toBe("entry_1st_thing");
    expect(suggestEntryPath("!!!")).toBe("");
  });

  it("validates <modid>:<path>", () => {
    expect(isEntryId("my_mod:iron_gear")).toBe(true);
    expect(isEntryId("my_mod:Iron")).toBe(false);
    expect(isEntryId("my_mod:a:b")).toBe(false);
    expect(isEntryId("x:gear")).toBe(false);
  });
});

describe("entrySchema", () => {
  it("builds a valid default for every type", () => {
    for (const type of ENTRY_TYPES) {
      const entry = defaultEntry(type, ID, "Thing");
      expect(entry.type).toBe(type);
      expect(entry.status).toBe("backlog");
      expect(parse(entry).success).toBe(true);
    }
  });

  it("rejects fields of another kind", () => {
    const material = defaultEntry("item", ID, "Thing");
    expect(parse(withFields(material, { defense: 3 })).success).toBe(false);
    const tool = switchKind(
      material as Extract<Entry, { type: "item" }>,
      "tool",
    ).entry;
    expect(parse(withFields(tool, { nutrition: 4 })).success).toBe(false);
    expect(parse(withFields(tool, { slot: "head" })).success).toBe(false);
  });

  it("allows spawn on every entity kind but projectile, and a boss bar only on bosses", () => {
    const passive = defaultEntry("entity", ID, "Thing") as Extract<
      Entry,
      { type: "entity" }
    >;
    expect(
      parse(
        withFields(passive, { bossBar: { color: "red", overlay: "progress" } }),
      ).success,
    ).toBe(false);
    const projectile = switchKind(passive, "projectile").entry;
    expect("spawn" in projectile).toBe(false);
    expect(
      parse(
        withFields(projectile, {
          spawn: (passive as { spawn: unknown }).spawn,
        }),
      ).success,
    ).toBe(false);
    const boss = switchKind(passive, "boss").entry;
    expect(boss).toMatchObject({ bossBar: { color: "purple" } });
  });

  it("uses dependent unions for harvest, GUI and drops", () => {
    const block = defaultEntry("block", ID, "Thing");
    expect(
      parse(withFields(block, { harvest: { tool: "none", tier: "iron" } }))
        .success,
    ).toBe(false);
    expect(
      parse(withFields(block, { gui: { hasGui: false, slots: "3 slots" } }))
        .success,
    ).toBe(false);
    expect(
      parse(withFields(block, { gui: { hasGui: true, slots: "3 slots" } }))
        .success,
    ).toBe(true);
    expect(
      parse(withFields(block, { drops: { type: "self", items: [] } })).success,
    ).toBe(false);
    expect(
      parse(withFields(block, { drops: { type: "other", items: [] } })).success,
    ).toBe(false);
  });

  it("checks multiblock layers against dimensions and structure placement", () => {
    const mb = defaultEntry("multiblock", ID, "Thing");
    expect(parse(withFields(mb, { layers: [[null]] })).success).toBe(false);
    const structure = defaultEntry("structure", ID, "Thing");
    expect(
      parse(withFields(structure, { placement: { spacing: 8, separation: 8 } }))
        .success,
    ).toBe(false);
  });

  it("only lets item and block entries have recipes, with the entry as result", () => {
    expect(
      parse(withFields(defaultEntry("entity", ID, "Thing"), { recipes: [] }))
        .success,
    ).toBe(false);
    const item = defaultEntry("item", ID, "Thing");
    const recipe = {
      type: "minecraft:stonecutting",
      ingredient: { item: "minecraft:stone" },
      result: { id: ID, count: 1 },
    };
    expect(parse(withFields(item, { recipes: [recipe] })).success).toBe(true);
    expect(
      parse(
        withFields(item, {
          recipes: [{ ...recipe, result: { id: "minecraft:dirt", count: 1 } }],
        }),
      ).success,
    ).toBe(false);
    expect(isItemEntry(item)).toBe(true);
  });

  it("requires a label for custom relations", () => {
    const item = defaultEntry("item", ID, "Thing");
    expect(
      parse(
        withFields(item, {
          relations: [{ type: "custom", target: "my_mod:b" }],
        }),
      ).success,
    ).toBe(false);
    expect(
      parse(
        withFields(item, {
          relations: [{ type: "custom", target: "my_mod:b", label: "feeds" }],
        }),
      ).success,
    ).toBe(true);
    expect(
      parse(
        withFields(item, {
          relations: [{ type: "powers", target: "my_mod:b", label: "x" }],
        }),
      ).success,
    ).toBe(false);
  });
});

describe("switchKind", () => {
  const material = defaultEntry("item", ID, "Thing") as Extract<
    Entry,
    { type: "item" }
  >;

  it("adds the new kind's defaults and keeps shared fields", () => {
    const tool = switchKind(material, "tool").entry;
    const weapon = switchKind(
      { ...tool, durability: 999 } as typeof tool,
      "weapon",
    );
    expect(weapon.entry).toMatchObject({ kind: "weapon", durability: 999 });
    expect("tier" in weapon.entry).toBe(false);
    expect(weapon.lost).toEqual([]); // tier was still its default
  });

  it("reports changed fields it drops", () => {
    const tool = switchKind(material, "tool").entry;
    const food = switchKind(
      { ...tool, tier: "diamond", attackDamage: 9 } as typeof tool,
      "food",
    );
    expect(food.lost.sort()).toEqual(["attackDamage", "tier"]);
    expect(food.entry).toMatchObject({ kind: "food", nutrition: 4 });
  });
});

describe("references", () => {
  const item = defaultEntry("item", "my_mod:gear", "Gear");
  const mechanic = {
    ...defaultEntry("mechanic", "my_mod:heat", "Heat"),
    involvedEntries: ["my_mod:gear"],
    relations: [{ type: "powers" as const, target: "my_mod:press" }],
  } as Entry;
  const multiblock = {
    ...defaultEntry("multiblock", "my_mod:smelter", "Smelter"),
    dimensions: { width: 1, height: 1, depth: 1 },
    layers: [["my_mod:gear"]],
    controller: "minecraft:furnace",
    recipeTypes: ["melting"],
  } as Entry;

  it("lists linked entries, used items and recipe types", () => {
    expect(linkedEntryIds(mechanic).sort()).toEqual([
      "my_mod:gear",
      "my_mod:press",
    ]);
    expect(usedItemIds(multiblock).sort()).toEqual([
      "minecraft:furnace",
      "my_mod:gear",
    ]);
    expect(usedRecipeTypes(multiblock)).toEqual(["melting"]);
    expect(referencesEntry(mechanic, "my_mod:gear")).toBe(true);
    expect(referencesEntry(multiblock, "my_mod:gear")).toBe(true);
    expect(referencesEntry(item, "my_mod:gear")).toBe(false);
  });

  it("removes only relations to a deleted entry", () => {
    const cleaned = withoutRelationsTo(mechanic, "my_mod:press");
    expect(cleaned.relations).toEqual([]);
    expect(
      (cleaned as Extract<Entry, { type: "mechanic" }>).involvedEntries,
    ).toEqual(["my_mod:gear"]);
  });
});

describe("resizeLayers", () => {
  it("keeps cells that still fit", () => {
    const layers = [["a:1", "a:2", "a:3", "a:4"]]; // 2×2
    expect(
      resizeLayers(
        layers,
        { width: 2, depth: 2 },
        { width: 3, height: 2, depth: 1 },
      ),
    ).toEqual([
      ["a:1", "a:2", null],
      [null, null, null],
    ]);
  });
});

describe("withEntryId", () => {
  it("moves visual recipe results to the new ID", () => {
    const item = {
      ...defaultEntry("item", "my_mod:a", "A"),
      recipes: [
        {
          type: "minecraft:stonecutting" as const,
          ingredient: { item: "minecraft:stone" },
          result: { id: "my_mod:a", count: 2 },
        },
      ],
    } as Entry;
    const moved = withEntryId(item, "my_mod:b");
    expect(moved.id).toBe("my_mod:b");
    expect(entrySchema.safeParse(moved).success).toBe(true);
  });
});

describe("switchKind on drafts", () => {
  it("works while other fields are still invalid", () => {
    const draft = {
      ...defaultEntry("entity", ID, "Thing"),
      id: "my_mod:",
    } as Extract<Entry, { type: "entity" }>;
    const { entry } = switchKind(draft, "projectile");
    expect(entry.kind).toBe("projectile");
    expect("spawn" in entry).toBe(false);
  });
});

describe("schema details", () => {
  it("switches every item and entity kind to a valid entry", () => {
    const item = defaultEntry("item", ID, "Thing") as Extract<
      Entry,
      { type: "item" }
    >;
    for (const kind of ITEM_KINDS) {
      expect(entrySchema.safeParse(switchKind(item, kind).entry).success).toBe(
        true,
      );
    }
    const entity = defaultEntry("entity", ID, "Thing") as Extract<
      Entry,
      { type: "entity" }
    >;
    for (const kind of ENTITY_KINDS) {
      expect(
        entrySchema.safeParse(switchKind(entity, kind).entry).success,
      ).toBe(true);
    }
  });

  it("rejects duplicate obtainedVia values", () => {
    const item = defaultEntry("item", ID, "Thing");
    expect(
      entrySchema.safeParse({ ...item, obtainedVia: ["drop", "drop"] }).success,
    ).toBe(false);
  });

  it("moves custom recipe outputs with a new entry ID", () => {
    const item = {
      ...defaultEntry("item", "my_mod:a", "A"),
      recipes: [
        {
          type: "custom",
          recipeType: "melting",
          inputs: [{ type: "energy", amount: 10 }],
          outputs: [
            { type: "item", item: "my_mod:a", count: 1 },
            { type: "item", item: "minecraft:stone", count: 1 },
          ],
        },
      ],
    } as Entry;
    const moved = withEntryId(item, "my_mod:b") as Extract<
      Entry,
      { type: "item" }
    >;
    const outputs = (moved.recipes[0] as { outputs: { item: string }[] })
      .outputs;
    expect(outputs.map((o) => o.item)).toEqual(["my_mod:b", "minecraft:stone"]);
  });
});
