import { describe, expect, it } from "vitest";
import { missingDependencies } from "./dependencies";

const dep = (modId: string, type: "required" | "optional" = "required") => ({
  modId,
  type,
  versionRange: "*",
});

describe("missingDependencies", () => {
  it("lists required dependencies no pack mod provides, ignoring platform IDs", () => {
    const missing = missingDependencies(
      [
        {
          name: "Farmer's Delight",
          modIds: ["farmersdelight"],
          dependencies: [
            dep("minecraft"),
            dep("neoforge"),
            dep("java"),
            dep("cloth_config"),
          ],
        },
        {
          name: "Create",
          modIds: ["create", "ponder", "flywheel"],
          dependencies: [
            dep("ponder"),
            dep("cloth_config"),
            dep("jei", "optional"),
          ],
        },
      ],
      [{ name: "My Mod", dependencies: ["farmersdelight", "botania"] }],
    );
    expect(missing).toEqual([
      { modId: "botania", requiredBy: ["My Mod"] },
      { modId: "cloth_config", requiredBy: ["Create", "Farmer's Delight"] },
    ]);
  });

  it("is empty when everything is provided", () => {
    expect(
      missingDependencies(
        [
          {
            name: "A",
            modIds: ["a"],
            dependencies: [dep("fabricloader"), dep("forge")],
          },
        ],
        [{ name: "Mine", dependencies: ["a"] }],
      ),
    ).toEqual([]);
  });
});
