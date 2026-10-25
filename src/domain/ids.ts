/** NeoForge mod ID rule; custom mod IDs are also folder names (ADR 0015). */
export const MOD_ID_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

/** Kebab-case modpack ID, also the folder name (ADR 0015). */
export const PACK_ID_PATTERN = /^(?=.{1,64}$)[a-z0-9]+(-[a-z0-9]+)*$/;

export const isModId = (value: string) => MOD_ID_PATTERN.test(value);
export const isPackId = (value: string) => PACK_ID_PATTERN.test(value);

function asciiWords(name: string): string[] {
  return name
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Suggests a custom mod ID from a display name, e.g. "Iron Works!" → "iron_works". */
export function suggestModId(name: string): string {
  let id = asciiWords(name).join("_");
  if (id && !/^[a-z]/.test(id)) id = `mod_${id}`;
  id = id.slice(0, 64).replace(/_+$/, "");
  return isModId(id) ? id : "";
}

/** Suggests a modpack ID from a display name, e.g. "Sky Factory 5" → "sky-factory-5". */
export function suggestPackId(name: string): string {
  const id = asciiWords(name).join("-").slice(0, 64).replace(/-+$/, "");
  return isPackId(id) ? id : "";
}
