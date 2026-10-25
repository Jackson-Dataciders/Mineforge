import { z } from "zod";
import { modIdSchema, projectNameSchema } from "./custom-mod";
import { PACK_ID_PATTERN } from "./ids";

export const packIdSchema = z.string().regex(PACK_ID_PATTERN);

/** `data/modpacks/<pack-id>/pack.json`. References mods by ID, never copies them. */
export const modpackSchema = z.strictObject({
  id: packIdSchema,
  name: projectNameSchema,
  libraryModIds: z.array(modIdSchema).default([]),
  customModIds: z.array(modIdSchema).default([]),
});
export type Modpack = z.infer<typeof modpackSchema>;
