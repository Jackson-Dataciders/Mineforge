/** Repo paths of all data files (see docs/architecture.md, Data layout). */
export const paths = {
  customModsDir: "data/custom-mods",
  customModDir: (modId: string) => `data/custom-mods/${modId}`,
  customModFile: (modId: string) => `data/custom-mods/${modId}/mod.json`,
  customModIconsDir: (modId: string) => `assets/icons/${modId}`,
  modpacksDir: "data/modpacks",
  modpackDir: (packId: string) => `data/modpacks/${packId}`,
  modpackFile: (packId: string) => `data/modpacks/${packId}/pack.json`,
  libraryDir: "data/library",
} as const;
