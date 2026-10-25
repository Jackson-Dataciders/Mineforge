import { describe, expect, it } from "vitest";
import {
  JAR_NAME_PATTERN,
  jarFileProblem,
  MAX_JAR_BYTES,
  sanitizeJarName,
} from "./jar-upload";

describe("sanitizeJarName", () => {
  it.each([
    ["FarmersDelight-1.21.1-1.3.4.jar", "FarmersDelight-1.21.1-1.3.4.jar"],
    ["Farmer's Delight (1.21.1).JAR", "Farmer_s_Delight_1.21.1_.jar"],
    ["C:\\fakepath\\mod.jar", "mod.jar"],
    ["../../evil.jar", "evil.jar"],
    ["...jar", "mod.jar"],
    ["éàü.jar", "mod.jar"],
  ])("%s → %s", (input, expected) => {
    const name = sanitizeJarName(input);
    expect(name).toBe(expected);
    expect(JAR_NAME_PATTERN.test(name)).toBe(true);
  });
});

describe("jarFileProblem", () => {
  it("accepts jars up to 100 MiB", () => {
    expect(jarFileProblem({ name: "a.jar", size: MAX_JAR_BYTES })).toBeNull();
    expect(jarFileProblem({ name: "a.jar", size: MAX_JAR_BYTES + 1 })).toBe(
      "tooLarge",
    );
    expect(jarFileProblem({ name: "a.zip", size: 10 })).toBe("notJar");
    expect(jarFileProblem({ name: "a.jar", size: 0 })).toBe("empty");
  });
});
