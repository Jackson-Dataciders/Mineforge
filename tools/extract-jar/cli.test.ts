import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli } from "./cli";
import { buildJar, fakePng } from "./test-jar";

const JAR = buildJar({
  "META-INF/neoforge.mods.toml":
    '[[mods]]\nmodId="testmod"\nversion="1.0"\ndisplayName="Test"\n',
  "assets/testmod/lang/en_us.json": {
    "item.testmod.gear": "Gear",
    "item.testmod.wheel": "Wheel",
  },
  "assets/testmod/models/item/wheel.json": { parent: "builtin/entity" },
  "assets/testmod/models/item/gear.json": {
    parent: "item/generated",
    textures: { layer0: "testmod:item/gear" },
  },
  "assets/testmod/textures/item/gear.png": fakePng("gear"),
  "data/testmod/recipe/gear.json": {
    type: "minecraft:crafting_shapeless",
    ingredients: [],
  },
  "data/c/tags/item/gears.json": { values: ["testmod:gear"] },
});

let root: string;
const lines: string[] = [];
const out = {
  log: (l: string) => lines.push(l),
  error: (l: string) => lines.push(l),
};

function snapshot(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else
        result[path.relative(root, full).split(path.sep).join("/")] =
          readFileSync(full).toString("base64");
    }
  };
  walk(dir);
  return result;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "mineforge-extract-"));
  mkdirSync(path.join(root, "jars/mods"), { recursive: true });
  writeFileSync(path.join(root, "jars/mods/testmod-1.0.jar"), JAR);
  lines.length = 0;
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("extract-jar CLI", () => {
  it("writes sorted, stable files and prints a summary", () => {
    const code = runCli(
      [path.join(root, "jars/mods/testmod-1.0.jar")],
      root,
      out,
    );
    expect(code).toBe(0);
    expect(lines[0]).toMatch(
      /^testmod 1\.0 \(neoforge\) — 2 items \(0 inferred\), 1 recipes, 1 tags, 1 icons missing, 0 icon fallbacks → data\/library\/testmod/,
    );
    const files = Object.keys(snapshot(root))
      .filter((f) => !f.startsWith("jars/"))
      .sort();
    expect(files).toEqual([
      "assets/textures/testmod/item/gear.png",
      "data/library/testmod/items.json",
      "data/library/testmod/meta.json",
      "data/library/testmod/recipes.json",
      "data/library/testmod/tags.json",
    ]);
    const items = readFileSync(
      path.join(root, "data/library/testmod/items.json"),
      "utf8",
    );
    expect(items.endsWith("\n")).toBe(true);
    expect(JSON.parse(items).map((i: { id: string }) => i.id)).toEqual([
      "testmod:gear",
      "testmod:wheel",
    ]);
    expect(
      JSON.parse(
        readFileSync(path.join(root, "data/library/testmod/meta.json"), "utf8"),
      ).jarFile,
    ).toBe("jars/mods/testmod-1.0.jar");
  });

  it("is idempotent and keeps inferred records", () => {
    const jar = path.join(root, "jars/mods/testmod-1.0.jar");
    runCli([jar], root, out);
    const itemsFile = path.join(root, "data/library/testmod/items.json");
    const items = JSON.parse(readFileSync(itemsFile, "utf8"));
    items.push(
      {
        id: "testmod:axle",
        name: "Axle",
        icon: null,
        source: "inferred",
        evidence: "com.example.Items#AXLE",
      },
      {
        id: "testmod:wheel",
        name: "Wheel?",
        icon: null,
        source: "inferred",
        evidence: "X",
      },
    );
    writeFileSync(itemsFile, JSON.stringify(items));

    runCli([jar], root, out);
    const first = snapshot(root);
    lines.length = 0;
    runCli([jar], root, out);
    expect(snapshot(root)).toEqual(first);
    expect(lines[0]).toContain("(0 files changed)");

    const ids = JSON.parse(readFileSync(itemsFile, "utf8")).map(
      (i: { id: string; source: string }) => `${i.id}:${i.source}`,
    );
    // Inferred axle kept; extracted wheel replaces the inferred one with the same ID.
    expect(ids).toEqual([
      "testmod:axle:inferred",
      "testmod:gear:extracted",
      "testmod:wheel:extracted",
    ]);
  });

  it("fails for jars outside jars/, missing jars and missing arguments", () => {
    const outside = path.join(root, "x.jar");
    writeFileSync(outside, JAR);
    expect(runCli([outside], root, out)).toBe(1);
    expect(runCli([path.join(root, "jars/mods/missing.jar")], root, out)).toBe(
      1,
    );
    expect(runCli([], root, out)).toBe(1);
    expect(lines.join("\n")).toContain("must be inside");
  });

  it("fails cleanly on a jar without metadata", () => {
    writeFileSync(
      path.join(root, "jars/mods/bad.jar"),
      buildJar({ "a.txt": "x" }),
    );
    expect(runCli([path.join(root, "jars/mods/bad.jar")], root, out)).toBe(1);
    expect(lines.at(-1)).toMatch(/^error: No mod metadata/);
  });
});

describe("extract-jar CLI: existing data", () => {
  it("aborts without writing when an existing data file is invalid", () => {
    const jar = path.join(root, "jars/mods/testmod-1.0.jar");
    mkdirSync(path.join(root, "data/library/testmod"), { recursive: true });
    writeFileSync(
      path.join(root, "data/library/testmod/tags.json"),
      "{ broken",
    );
    expect(runCli([jar], root, out)).toBe(1);
    expect(lines.at(-1)).toMatch(/^error: .*tags\.json is not valid JSON/);
    expect(readdirSync(path.join(root, "data/library/testmod"))).toEqual([
      "tags.json",
    ]);
  });

  it("keeps inferred recipes across re-runs", () => {
    const jar = path.join(root, "jars/mods/testmod-1.0.jar");
    runCli([jar], root, out);
    const file = path.join(root, "data/library/testmod/recipes.json");
    const recipes = JSON.parse(readFileSync(file, "utf8"));
    recipes.push({
      id: "testmod:axle_from_code",
      type: "minecraft:crafting_shapeless",
      source: "inferred",
      evidence: "com.example.Recipes#axle",
      data: { type: "minecraft:crafting_shapeless" },
    });
    writeFileSync(file, JSON.stringify(recipes));
    runCli([jar], root, out);
    const ids = JSON.parse(readFileSync(file, "utf8")).map(
      (r: { id: string }) => r.id,
    );
    expect(ids).toEqual(["testmod:axle_from_code", "testmod:gear"]);
  });
});
