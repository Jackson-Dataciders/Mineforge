import { describe, expect, it } from "vitest";
import { extractJar } from "./extract";
import { ExtractError } from "./metadata";
import { buildJar, fakePng } from "./test-jar";

const options = { jarFile: "jars/mods/test.jar", textureExists: () => false };

const NEOFORGE_TOML = `
modLoader = "javafml"
loaderVersion = "[4,)"
license = "MIT"

[[mods]]
modId = "testmod"
version = "\${file.jarVersion}"
displayName = "Test Mod"

[[mods]]
modId = "testmod_extra"

[[dependencies.testmod]]
modId = "neoforge"
type = "required"
versionRange = "[21.1,)"

[[dependencies.testmod]]
modId = "minecraft"
type = "required"
versionRange = "[1.21.1]"

[[dependencies.testmod]]
modId = "jei"
type = "optional"

[[dependencies.testmod_extra]]
modId = "testmod"
type = "required"
`;

function neoforgeJar(extra: Record<string, string | object | Uint8Array> = {}) {
  return buildJar({
    "META-INF/neoforge.mods.toml": NEOFORGE_TOML,
    "META-INF/MANIFEST.MF":
      "Manifest-Version: 1.0\r\nImplementation-Version: 2.5.0\r\n",
    "assets/testmod/lang/en_us.json": {
      "item.testmod.gear": "Gear",
      "item.testmod.gear.tooltip": "Not an item",
      "block.testmod.machine": "Machine",
      "block.testmod.fluid": "Fluid (no item)",
      "item.testmod.statue": "Statue",
      "item.testmod.no_model": "Stale lang key without a model",
      "item.othermod.foreign": "Not ours",
      "itemGroup.testmod": "Creative tab",
    },
    "assets/testmod/models/item/gear.json": {
      parent: "minecraft:item/generated",
      textures: { layer0: "testmod:item/gear" },
    },
    "assets/testmod/models/item/machine.json": {
      parent: "testmod:block/machine",
    },
    "assets/testmod/models/block/machine.json": {
      parent: "testmod:block/machine_base",
      textures: { side: "#front" },
    },
    "assets/testmod/models/block/machine_base.json": {
      parent: "minecraft:block/cube",
      textures: {
        front: "testmod:block/machine_front",
        top: "testmod:block/machine_top",
      },
    },
    "assets/testmod/models/item/statue.json": {
      parent: "builtin/entity",
      textures: { particle: "testmod:block/machine_top" },
    },
    "assets/testmod/textures/item/gear.png": fakePng("gear"),
    "assets/testmod/textures/block/machine_front.png": fakePng("front"),
    "assets/testmod/textures/block/machine_top.png": fakePng("top"),
    "assets/minecraft/lang/en_us.json": {
      "item.minecraft.stick": "Overridden Stick",
    },
    "data/testmod/recipe/gear.json": {
      type: "minecraft:crafting_shaped",
      pattern: ["#"],
      key: { "#": { item: "minecraft:iron_ingot" } },
      result: { id: "testmod:gear", count: 1 },
    },
    "data/testmod/recipe/machines/machine.json": {
      type: "testmod:assembling",
      input: { tag: "c:ingots/iron" },
    },
    "data/minecraft/recipe/cake.json": {
      type: "minecraft:crafting_shapeless",
      ingredients: [],
    },
    "data/testmod/recipe/broken.json": "{ not json",
    "data/testmod/recipes/legacy.json": {
      type: "minecraft:crafting_shapeless",
    },
    "data/c/tags/item/gears.json": {
      values: ["testmod:gear", { id: "othermod:gear", required: false }],
    },
    "data/minecraft/tags/item/logs.json": {
      replace: true,
      values: ["#testmod:logs"],
    },
    ...extra,
  });
}

describe("extractJar: NeoForge", () => {
  const result = extractJar(neoforgeJar(), options);

  it("reads metadata, dependencies and the manifest version", () => {
    expect(result.kind).toBe("mod");
    expect(result.meta).toMatchObject({
      modId: "testmod",
      name: "Test Mod",
      version: "2.5.0",
      loader: "neoforge",
      minecraftVersionRange: "[1.21.1]",
      modIds: ["testmod", "testmod_extra"],
      jarFile: "jars/mods/test.jar",
    });
    expect(result.meta?.jarSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.meta?.dependencies).toEqual([
      { modId: "jei", type: "optional", versionRange: "*" },
      { modId: "minecraft", type: "required", versionRange: "[1.21.1]" },
      { modId: "neoforge", type: "required", versionRange: "[21.1,)" },
    ]);
  });

  it("extracts items with icons, fallbacks and missing icons", () => {
    expect(result.items).toEqual([
      {
        id: "testmod:gear",
        name: "Gear",
        icon: "testmod/item/gear.png",
        source: "extracted",
      },
      {
        id: "testmod:machine",
        name: "Machine",
        icon: "testmod/block/machine_front.png",
        iconFallback: true,
        source: "extracted",
      },
      { id: "testmod:statue", name: "Statue", icon: null, source: "extracted" },
    ]);
    expect([...result.textures.keys()].sort()).toEqual([
      "testmod/block/machine_front.png",
      "testmod/item/gear.png",
    ]);
  });

  it("reads recipes from every namespace and skips broken ones", () => {
    expect(result.recipes.map((r) => [r.id, r.type])).toEqual([
      ["minecraft:cake", "minecraft:crafting_shapeless"],
      ["testmod:gear", "minecraft:crafting_shaped"],
      ["testmod:machines/machine", "testmod:assembling"],
    ]);
    expect(result.recipes[1]?.data).toMatchObject({
      result: { id: "testmod:gear", count: 1 },
    });
    expect(result.warnings).toContain(
      "Skipped unreadable recipe data/testmod/recipe/broken.json",
    );
    expect(
      result.warnings.some((w) => w.startsWith("1 files in pre-1.21 folders")),
    ).toBe(true);
  });

  it("reads item tags", () => {
    expect(result.tags).toEqual({
      "c:gears": {
        replace: false,
        values: ["testmod:gear", { id: "othermod:gear", required: false }],
      },
      "minecraft:logs": { replace: true, values: ["#testmod:logs"] },
    });
  });

  it("keeps vanilla textures that the repo already has", () => {
    const jar = neoforgeJar({
      "assets/testmod/models/item/gear.json": {
        parent: "item/generated",
        textures: { layer0: "item/iron_ingot" },
      },
    });
    const withVanilla = extractJar(jar, {
      ...options,
      textureExists: (p) => p === "minecraft/item/iron_ingot.png",
    });
    expect(withVanilla.items[0]?.icon).toBe("minecraft/item/iron_ingot.png");
    expect(extractJar(jar, options).items[0]?.icon).toBeNull();
  });
});

describe("extractJar: other loaders and vanilla", () => {
  it("reads Forge mods.toml with the legacy mandatory flag", () => {
    const jar = buildJar({
      "META-INF/mods.toml": `
modLoader="javafml"
[[mods]]
modId="oldmod"
version="1.0"
[[dependencies.oldmod]]
modId="forge"
mandatory=true
versionRange="[47,)"
[[dependencies.oldmod]]
modId="extras"
mandatory=false
`,
    });
    const { meta } = extractJar(jar, options);
    expect(meta).toMatchObject({
      modId: "oldmod",
      name: "oldmod",
      loader: "forge",
      minecraftVersionRange: null,
    });
    expect(meta?.dependencies).toEqual([
      { modId: "extras", type: "optional", versionRange: "*" },
      { modId: "forge", type: "required", versionRange: "[47,)" },
    ]);
  });

  it("reads fabric.mod.json", () => {
    const jar = buildJar({
      "fabric.mod.json": {
        schemaVersion: 1,
        id: "fabmod",
        version: "3.1.0",
        name: "Fab Mod",
        depends: {
          fabricloader: ">=0.15",
          minecraft: ["~1.21", "1.21.1"],
          "fabric-api": "*",
        },
        recommends: { modmenu: "*" },
        breaks: { badmod: "<2" },
      },
    });
    const { meta } = extractJar(jar, options);
    expect(meta).toMatchObject({
      modId: "fabmod",
      loader: "fabric",
      minecraftVersionRange: "~1.21 || 1.21.1",
    });
    expect(meta?.dependencies.map((d) => `${d.modId}:${d.type}`)).toEqual([
      "badmod:incompatible",
      "fabric-api:required",
      "fabricloader:required",
      "minecraft:required",
      "modmenu:optional",
    ]);
  });

  it("prefers neoforge.mods.toml in multi-loader jars", () => {
    const jar = buildJar({
      "META-INF/neoforge.mods.toml": '[[mods]]\nmodId="multi"\n',
      "fabric.mod.json": { id: "multi", version: "1" },
    });
    expect(extractJar(jar, options).meta?.loader).toBe("neoforge");
  });

  it("extracts the vanilla client jar and rejects other versions", () => {
    const jar = buildJar({
      "version.json": { id: "1.21.1" },
      "assets/minecraft/lang/en_us.json": {
        "item.minecraft.diamond": "Diamond",
        "block.minecraft.water": "Water",
      },
      "assets/minecraft/models/item/diamond.json": {
        parent: "minecraft:item/generated",
        textures: { layer0: "minecraft:item/diamond" },
      },
      "assets/minecraft/textures/item/diamond.png": fakePng("diamond"),
    });
    const result = extractJar(jar, options);
    expect(result.kind).toBe("vanilla");
    expect(result.meta).toBeNull();
    expect(result.items).toEqual([
      {
        id: "minecraft:diamond",
        name: "Diamond",
        icon: "minecraft/item/diamond.png",
        source: "extracted",
      },
    ]);
    expect(() =>
      extractJar(buildJar({ "version.json": { id: "1.20.1" } }), options),
    ).toThrow(ExtractError);
  });

  it("rejects jars without metadata", () => {
    expect(() => extractJar(buildJar({ "readme.txt": "hi" }), options)).toThrow(
      /No mod metadata/,
    );
  });
});

describe("extractJar: hostile or unusual content", () => {
  it("rejects mod IDs that are not valid folder names", () => {
    const jar = buildJar({
      "META-INF/neoforge.mods.toml": '[[mods]]\nmodId="../../evil"\n',
    });
    expect(() => extractJar(jar, options)).toThrow(/Invalid mod metadata/);
  });

  it("never copies textures with unsafe paths", () => {
    const jar = buildJar({
      "META-INF/neoforge.mods.toml": '[[mods]]\nmodId="testmod"\n',
      "assets/testmod/lang/en_us.json": { "item.testmod.gear": "Gear" },
      "assets/testmod/models/item/gear.json": {
        parent: "item/generated",
        textures: { layer0: "testmod:../../../../evil" },
      },
      "assets/testmod/textures/../../../../evil.png": fakePng("evil"),
    });
    const result = extractJar(jar, options);
    expect(result.items).toEqual([
      { id: "testmod:gear", name: "Gear", icon: null, source: "extracted" },
    ]);
    expect(result.textures.size).toBe(0);
    expect(
      result.warnings.some((w) => w.startsWith("No icon for testmod:gear")),
    ).toBe(true);
  });

  it("does not copy a mod's overrides of other namespaces' textures", () => {
    const jar = buildJar({
      "META-INF/neoforge.mods.toml": '[[mods]]\nmodId="testmod"\n',
      "assets/testmod/lang/en_us.json": { "item.testmod.rod": "Rod" },
      "assets/testmod/models/item/rod.json": {
        parent: "item/generated",
        textures: { layer0: "minecraft:item/stick" },
      },
      "assets/minecraft/textures/item/stick.png": fakePng("override"),
    });
    expect(extractJar(jar, options).items[0]?.icon).toBeNull();
    const withVanilla = extractJar(jar, {
      ...options,
      textureExists: () => true,
    });
    expect(withVanilla.items[0]?.icon).toBe("minecraft/item/stick.png");
    expect(withVanilla.textures.size).toBe(0);
  });

  it("drops tag values without a string id", () => {
    const jar = buildJar({
      "META-INF/neoforge.mods.toml": '[[mods]]\nmodId="testmod"\n',
      "data/c/tags/item/x.json": {
        values: ["testmod:a", { required: false }, 42],
      },
    });
    const result = extractJar(jar, options);
    expect(result.tags["c:x"]?.values).toEqual(["testmod:a"]);
    expect(result.warnings.filter((w) => w.startsWith("Dropped"))).toHaveLength(
      2,
    );
  });
});

describe("mod logo (ADR 0019)", () => {
  it("copies a NeoForge logoFile from the first [[mods]] entry", () => {
    const jar = buildJar({
      "META-INF/neoforge.mods.toml": `logoFile="top.png"
[[mods]]
modId="testmod"
logoFile="logo.png"
`,
      "logo.png": fakePng("logo"),
      "top.png": fakePng("top"),
    });
    const result = extractJar(jar, options);
    expect(result.meta?.logo).toBe("testmod/_logo.png");
    expect(result.textures.get("testmod/_logo.png")).toEqual(fakePng("logo"));
  });

  it("falls back to the top-level logoFile", () => {
    const jar = buildJar({
      "META-INF/mods.toml": `logoFile="art/top.png"
[[mods]]
modId="testmod"
`,
      "art/top.png": fakePng("top"),
    });
    expect(extractJar(jar, options).textures.get("testmod/_logo.png")).toEqual(
      fakePng("top"),
    );
  });

  it("picks the largest Fabric icon up to 256 px", () => {
    const jar = buildJar({
      "fabric.mod.json": {
        id: "fabmod",
        icon: { "16": "i16.png", "128": "i128.png", "512": "i512.png" },
      },
      "i16.png": fakePng("16"),
      "i128.png": fakePng("128"),
      "i512.png": fakePng("512"),
    });
    const result = extractJar(jar, options);
    expect(result.meta?.logo).toBe("fabmod/_logo.png");
    expect(result.textures.get("fabmod/_logo.png")).toEqual(fakePng("128"));
  });

  it("gives null with a warning for missing or non-PNG logos, and null without one", () => {
    const missing = extractJar(
      buildJar({
        "META-INF/neoforge.mods.toml": `[[mods]]
modId="testmod"
logoFile="gone.png"
`,
      }),
      options,
    );
    expect(missing.meta?.logo).toBeNull();
    expect(missing.warnings.some((w) => w.includes("missing"))).toBe(true);
    const jpg = extractJar(
      buildJar({
        "META-INF/neoforge.mods.toml": `[[mods]]
modId="testmod"
logoFile="logo.jpg"
`,
        "logo.jpg": fakePng("jpg"),
      }),
      options,
    );
    expect(jpg.meta?.logo).toBeNull();
    expect(jpg.textures.size).toBe(0);
    const none = extractJar(
      buildJar({
        "META-INF/neoforge.mods.toml": `[[mods]]
modId="testmod"
`,
      }),
      options,
    );
    expect(none.meta?.logo).toBeNull();
    expect(none.warnings).toEqual([]);
  });
});
