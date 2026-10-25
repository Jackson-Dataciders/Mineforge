import { z } from "zod";

/**
 * Library and vanilla data formats written by tools/extract-jar.ts and the
 * import-mods skill (ADR 0006, 0016, 0017). These schemas are the source of
 * truth for data/library/<modid>/* and data/vanilla/1.21.1/*.
 */

/** Namespaced Minecraft ID, e.g. `minecraft:stone`, `c:ingots/iron`. */
export const resourceIdSchema = z
  .string()
  .regex(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/);

/** Mod IDs: NeoForge allows `_`, Fabric also `-`. Also used as folder names. */
export const libraryModIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);

/** Path under `assets/textures/`; every segment starts with a non-dot character. */
export const ICON_PATH_PATTERN =
  /^[a-z0-9_-][a-z0-9_.-]*(\/[a-z0-9_-][a-z0-9_.-]*)+\.png$/;
export const isIconPath = (value: string) => ICON_PATH_PATTERN.test(value);

export const LOADERS = ["neoforge", "forge", "fabric"] as const;
export const loaderSchema = z.enum(LOADERS);
export type Loader = z.infer<typeof loaderSchema>;

export const dependencyTypeSchema = z.enum([
  "required",
  "optional",
  "incompatible",
  "discouraged",
]);

export const libraryDependencySchema = z.strictObject({
  modId: z.string().min(1),
  type: dependencyTypeSchema,
  /** Range as declared (Maven range for NeoForge/Forge, predicates for Fabric). */
  versionRange: z.string(),
});
export type LibraryDependency = z.infer<typeof libraryDependencySchema>;

/** `data/library/<modid>/meta.json`. */
export const libraryMetaSchema = z.strictObject({
  /** First mod declared in the jar; also the folder name. */
  modId: libraryModIdSchema,
  name: z.string(),
  version: z.string(),
  loader: loaderSchema,
  /** The jar's declared Minecraft version range, as written; `null` if none. */
  minecraftVersionRange: z.string().nullable(),
  /** Every mod ID declared in the jar (item namespaces). */
  modIds: z.array(libraryModIdSchema).min(1),
  /** Repo-relative path of the jar, e.g. `jars/mods/foo-1.0.jar`. */
  jarFile: z.string().min(1),
  jarSha256: z.string().regex(/^[0-9a-f]{64}$/),
  dependencies: z.array(libraryDependencySchema),
  /** Mod logo under `assets/textures/` (`<modid>/_logo.png`), or `null` (ADR 0019). */
  logo: z.string().regex(ICON_PATH_PATTERN).nullable().default(null),
});
export type LibraryMeta = z.infer<typeof libraryMetaSchema>;

export const dataSourceSchema = z.enum(["extracted", "inferred"]);
export type DataSource = z.infer<typeof dataSourceSchema>;

/** Inferred records must name the class (and method) they came from. */
const withEvidence = <T extends { source: DataSource; evidence?: string }>(
  record: T,
) => record.source === "extracted" || (record.evidence ?? "").trim().length > 0;

/** One entry of `items.json`. Names are always English (en_us). */
export const libraryItemSchema = z
  .strictObject({
    id: resourceIdSchema,
    name: z.string(),
    /** Path under `assets/textures/`, served at `/api/textures/<icon>`. */
    icon: z.string().regex(ICON_PATH_PATTERN).nullable(),
    /** The icon is a block face, not a real item texture. */
    iconFallback: z.literal(true).optional(),
    source: dataSourceSchema,
    evidence: z.string().optional(),
  })
  .refine(withEvidence, {
    message: "Inferred records need evidence",
    path: ["evidence"],
  });
export type LibraryItem = z.infer<typeof libraryItemSchema>;

/** One entry of `recipes.json`; `data` is the raw recipe JSON from the jar. */
export const libraryRecipeSchema = z
  .strictObject({
    id: resourceIdSchema,
    type: z.string(),
    source: dataSourceSchema,
    evidence: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
  })
  .refine(withEvidence, {
    message: "Inferred records need evidence",
    path: ["evidence"],
  });
export type LibraryRecipe = z.infer<typeof libraryRecipeSchema>;

export const tagValueSchema = z.union([
  z.string(),
  z.strictObject({ id: z.string(), required: z.boolean() }),
]);

/** `tags.json`: item tags by tag ID, values as declared in the jar. */
export const itemTagsSchema = z.record(
  resourceIdSchema,
  z.strictObject({ replace: z.boolean(), values: z.array(tagValueSchema) }),
);
export type ItemTags = z.infer<typeof itemTagsSchema>;

export const libraryItemsSchema = z.array(libraryItemSchema);
export const libraryRecipesSchema = z.array(libraryRecipeSchema);

/** The only supported Minecraft version (ADR 0007). */
export const TARGET_MINECRAFT_VERSION = "1.21.1";
