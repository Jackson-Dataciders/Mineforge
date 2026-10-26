import { z } from "zod";
import { customRecipeTypeSchema } from "./custom-recipe";
import { MOD_ID_PATTERN } from "./ids";
import { libraryModIdSchema } from "./library";

export const projectPhaseSchema = z.enum([
  "planning",
  "implementation",
  "optimization",
]);
export type ProjectPhase = z.infer<typeof projectPhaseSchema>;

export const modIdSchema = z.string().regex(MOD_ID_PATTERN);

export const projectNameSchema = z.string().trim().min(1).max(100);

/** `data/custom-mods/<modid>/mod.json`. Later phases add fields with defaults. */
export const customModSchema = z.strictObject({
  modId: modIdSchema,
  name: projectNameSchema,
  phase: projectPhaseSchema.default("planning"),
  /** Library mod folder IDs this custom mod depends on (Fabric IDs may contain `-`). */
  dependencies: z.array(libraryModIdSchema).default([]),
  /** Custom machine recipe types (spec 04, ADR 0021). */
  recipeTypes: z
    .array(customRecipeTypeSchema)
    .max(50)
    .default([])
    .refine(
      (types) => new Set(types.map((t) => t.id)).size === types.length,
      "Recipe type IDs must be unique",
    ),
});
export type CustomMod = z.infer<typeof customModSchema>;
