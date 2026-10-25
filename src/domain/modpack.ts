import { z } from "zod";
import { modIdSchema, projectNameSchema } from "./custom-mod";
import { PACK_ID_PATTERN } from "./ids";
import { libraryModIdSchema } from "./library";

export const packIdSchema = z.string().regex(PACK_ID_PATTERN);

/** `data/modpacks/<pack-id>/pack.json`. References mods by ID, never copies them. */
export const modpackSchema = z.strictObject({
  id: packIdSchema,
  name: projectNameSchema,
  /** Library mod folder IDs (Fabric IDs may contain `-`). */
  libraryModIds: z.array(libraryModIdSchema).default([]),
  customModIds: z.array(modIdSchema).default([]),
});
export type Modpack = z.infer<typeof modpackSchema>;
