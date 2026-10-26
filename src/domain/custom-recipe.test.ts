import { describe, expect, it } from "vitest";
import {
  customDraftToRecipe,
  customRecipeItems,
  customRecipeProblem,
  customRecipeToDraft,
  customRecipeTypeSchema,
  emptyCustomDraft,
  type CustomRecipe,
} from "./custom-recipe";

const type = customRecipeTypeSchema.parse({
  id: "melting",
  name: "Melting",
  machine: "my_mod:smelter",
  inputs: [{ type: "item" }, { type: "energy" }],
  outputs: [
    { type: "fluid", chance: false },
    { type: "item", chance: true },
  ],
  parameters: { processingTime: true, energyCost: false },
});

const recipe: CustomRecipe = {
  type: "custom",
  recipeType: "melting",
  inputs: [
    { type: "item", ingredient: { tag: "c:ores/iron" } },
    { type: "energy", amount: 2000 },
  ],
  outputs: [
    { type: "fluid", fluid: "my_mod:molten_iron", amount: 144 },
    { type: "item", item: "my_mod:slag", count: 1, chance: 0.25 },
  ],
  processingTime: 100,
};

describe("customRecipeProblem", () => {
  it("accepts a matching recipe", () => {
    expect(customRecipeProblem(recipe, type)).toBeNull();
  });

  it("reports slot count, slot type, chance and parameter mismatches", () => {
    expect(
      customRecipeProblem(
        { ...recipe, inputs: recipe.inputs.slice(0, 1) },
        type,
      ),
    ).toBe("slotCount");
    expect(
      customRecipeProblem(
        {
          ...recipe,
          inputs: [
            recipe.inputs[0]!,
            { type: "fluid", fluid: "a:b", amount: 1 },
          ],
        },
        type,
      ),
    ).toBe("slotType");
    expect(
      customRecipeProblem(
        {
          ...recipe,
          outputs: [
            recipe.outputs[0]!,
            { type: "item", item: "my_mod:slag", count: 1 },
          ],
        },
        type,
      ),
    ).toBe("chance");
    expect(customRecipeProblem({ ...recipe, energyCost: 5 }, type)).toBe(
      "parameters",
    );
    expect(
      customRecipeProblem({ ...recipe, processingTime: undefined }, type),
    ).toBe("parameters");
  });
});

describe("drafts", () => {
  it("builds an empty draft matching the type, with the entry as first item output", () => {
    const draft = emptyCustomDraft(type, "my_mod:slag");
    expect(draft.inputs.map((i) => i.type)).toEqual(["item", "energy"]);
    expect(draft.outputs[1]).toEqual({
      type: "item",
      item: "my_mod:slag",
      count: 1,
      chance: 1,
    });
    expect(draft.processingTime).toBe(200);
    expect("energyCost" in draft).toBe(false);
    expect(customDraftToRecipe(draft, type)).toEqual({
      ok: false,
      error: "incomplete",
    });
  });

  it("validates a completed draft", () => {
    const draft = emptyCustomDraft(type, "my_mod:slag");
    draft.inputs[0] = {
      type: "item",
      ingredient: { item: "minecraft:raw_iron" },
    };
    draft.outputs[0] = {
      type: "fluid",
      fluid: "my_mod:molten_iron",
      amount: 144,
    };
    expect(customDraftToRecipe(draft, type)).toMatchObject({ ok: true });
    draft.outputs[0] = { type: "fluid", fluid: "", amount: 144 };
    expect(customDraftToRecipe(draft, type)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("lists the items a recipe uses", () => {
    expect(customRecipeItems(recipe)).toEqual(["my_mod:slag"]);
  });
});

describe("customRecipeToDraft", () => {
  it("follows the type's current parameters and chances", () => {
    const changed = {
      ...type,
      outputs: [type.outputs[0]!, { type: "item" as const, chance: false }],
      parameters: { processingTime: false, energyCost: true },
    };
    const draft = customRecipeToDraft(recipe, changed);
    expect("processingTime" in draft).toBe(false);
    expect(draft.energyCost).toBe(1000);
    expect("chance" in draft.outputs[1]!).toBe(false);
    expect(customDraftToRecipe(draft, changed)).toMatchObject({ ok: true });
    expect(customRecipeToDraft(recipe)).toEqual(recipe);
  });
});
