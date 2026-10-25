import { describe, expect, it } from "vitest";
import {
  compareVersions,
  mavenRangeContains,
  targetCompatibility,
} from "./compatibility";

describe("compareVersions", () => {
  it("compares numerically and pads missing parts", () => {
    expect(compareVersions("1.21.1", "1.21")).toBe(1);
    expect(compareVersions("1.21", "1.21.0")).toBe(0);
    expect(compareVersions("1.9", "1.21")).toBe(-1);
    expect(compareVersions("1.21-pre1", "1.21")).toBe(-1);
  });
});

describe("mavenRangeContains", () => {
  it.each([
    ["[1.21,1.21.2)", true],
    ["[1.21.1,1.22)", true],
    ["[1.21.1]", true],
    ["[1.21]", false],
    ["[1.20,1.21)", false],
    ["(1.21.1,)", false],
    ["[1.21.1,)", true],
    ["(,1.21.1]", true],
    ["(,1.21.1)", false],
    ["[1.20,1.20.6],[1.21,1.21.1]", true],
    ["1.20.1", true],
    ["*", true],
  ])("%s contains 1.21.1 → %s", (spec, expected) => {
    expect(mavenRangeContains(spec, "1.21.1")).toBe(expected);
  });
});

describe("targetCompatibility", () => {
  it("requires NeoForge and a range containing 1.21.1", () => {
    expect(
      targetCompatibility({
        loader: "neoforge",
        minecraftVersionRange: "[1.21.1,1.22)",
      }),
    ).toEqual({ compatible: true });
    expect(
      targetCompatibility({ loader: "neoforge", minecraftVersionRange: null }),
    ).toEqual({
      compatible: true,
    });
    expect(
      targetCompatibility({ loader: "fabric", minecraftVersionRange: null }),
    ).toEqual({
      compatible: false,
      reason: "loader",
    });
    expect(
      targetCompatibility({
        loader: "neoforge",
        minecraftVersionRange: "[1.20.1,1.21)",
      }),
    ).toEqual({ compatible: false, reason: "version" });
  });
});
