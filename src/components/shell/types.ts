import {
  MOD_ID_PATTERN,
  PACK_ID_PATTERN,
  suggestModId,
  suggestPackId,
} from "@/domain/ids";

export type ViewId = "designer" | "modpacks";

/** What the shell needs to know about a custom mod or modpack. */
export type ProjectSummary = { id: string; name: string; sha: string };
export type ModpackSummary = ProjectSummary & { customModIds: string[] };

/** Per-view settings for the project selector and its dialogs. */
export const VIEW_CONFIG = {
  designer: {
    basePath: "/designer",
    api: "/api/custom-mods",
    messages: "projects.customMod",
    idPattern: MOD_ID_PATTERN,
    suggestId: suggestModId,
  },
  modpacks: {
    basePath: "/modpacks",
    api: "/api/modpacks",
    messages: "projects.modpack",
    idPattern: PACK_ID_PATTERN,
    suggestId: suggestPackId,
  },
} as const;

export function viewFromPath(pathname: string): {
  view: ViewId;
  selectedId: string | null;
} {
  const [, first, second] = pathname.split("/");
  const view: ViewId = first === "modpacks" ? "modpacks" : "designer";
  return { view, selectedId: second ? decodeURIComponent(second) : null };
}
