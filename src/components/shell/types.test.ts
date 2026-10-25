import { describe, expect, it } from "vitest";
import { viewFromPath } from "./types";

describe("viewFromPath", () => {
  it("maps paths to the view and selected project", () => {
    expect(viewFromPath("/designer/my_mod")).toEqual({
      view: "designer",
      selectedId: "my_mod",
    });
    expect(viewFromPath("/modpacks/pack/recipe-changes/new")).toEqual({
      view: "modpacks",
      selectedId: "pack",
    });
    expect(viewFromPath("/library")).toEqual({
      view: "modpacks",
      selectedId: null,
    });
    expect(viewFromPath("/")).toEqual({ view: "designer", selectedId: null });
  });
});
