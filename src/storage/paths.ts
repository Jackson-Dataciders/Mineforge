/** Repo paths of all data files (see docs/architecture.md, Data layout). */
export const paths = {
  customModsDir: "data/custom-mods",
  customModDir: (modId: string) => `data/custom-mods/${modId}`,
  customModFile: (modId: string) => `data/custom-mods/${modId}/mod.json`,
  customModIconsDir: (modId: string) => `assets/icons/${modId}`,
  modpacksDir: "data/modpacks",
  modpackDir: (packId: string) => `data/modpacks/${packId}`,
  modpackFile: (packId: string) => `data/modpacks/${packId}/pack.json`,
  modpackTasksFile: (packId: string) => `data/modpacks/${packId}/tasks.json`,
  recipeChangesDir: (packId: string) =>
    `data/modpacks/${packId}/recipe-changes`,
  recipeChangeFile: (packId: string, changeId: string) =>
    `data/modpacks/${packId}/recipe-changes/${changeId}.json`,
  libraryDir: "data/library",
  libraryFile: (modId: string, file: LibraryFileName) =>
    `data/library/${modId}/${file}`,
  vanillaDir: "data/vanilla/1.21.1",
  vanillaFile: (file: Exclude<LibraryFileName, "meta.json">) =>
    `data/vanilla/1.21.1/${file}`,
  modJarsDir: "jars/mods",
} as const;

export type LibraryFileName =
  | "meta.json"
  | "items.json"
  | "recipes.json"
  | "tags.json";
