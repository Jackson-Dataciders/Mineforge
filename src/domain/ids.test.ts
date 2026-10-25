import { describe, expect, it } from "vitest";
import { customModSchema } from "./custom-mod";
import { isModId, isPackId, suggestModId, suggestPackId } from "./ids";
import { modpackSchema } from "./modpack";

describe("ID rules", () => {
  it("validates mod IDs with the NeoForge rule", () => {
    expect(isModId("iron_works")).toBe(true);
    expect(isModId("a")).toBe(false);
    expect(isModId("1mod")).toBe(false);
    expect(isModId("Iron")).toBe(false);
    expect(isModId("a".repeat(65))).toBe(false);
  });

  it("validates kebab-case pack IDs", () => {
    expect(isPackId("sky-factory-5")).toBe(true);
    expect(isPackId("-sky")).toBe(false);
    expect(isPackId("sky--pack")).toBe(false);
    expect(isPackId("a".repeat(65))).toBe(false);
  });

  it("suggests IDs from names", () => {
    expect(suggestModId("Iron Works!")).toBe("iron_works");
    expect(suggestModId("Größere Öfen")).toBe("grossere_ofen");
    expect(suggestModId("3D Things")).toBe("mod_3d_things");
    expect(suggestModId("!!")).toBe("");
    expect(suggestPackId("Sky Factory 5")).toBe("sky-factory-5");
    expect(suggestPackId("Überpack")).toBe("uberpack");
  });
});

describe("project schemas", () => {
  it("fills defaults and rejects unknown keys", () => {
    expect(customModSchema.parse({ modId: "abc", name: "Abc" })).toEqual({
      modId: "abc",
      name: "Abc",
      phase: "planning",
      dependencies: [],
    });
    expect(
      customModSchema.safeParse({ modId: "abc", name: "Abc", extra: 1 })
        .success,
    ).toBe(false);
    expect(
      customModSchema.safeParse({ modId: "abc", name: "  " }).success,
    ).toBe(false);
    expect(modpackSchema.safeParse({ id: "Bad", name: "X" }).success).toBe(
      false,
    );
  });
});
