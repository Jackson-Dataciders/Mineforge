import { z } from "zod";
import { MOD_ID_PATTERN } from "./ids";

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
  /** Library mod IDs this custom mod depends on. */
  dependencies: z.array(modIdSchema).default([]),
});
export type CustomMod = z.infer<typeof customModSchema>;
