import type { VisualRecipeType } from "@/domain/recipe";
import type { MessageKey } from "@/i18n/types";

/** i18n key of a recipe type's display name (usable on server and client). */
export function recipeTypeKey(type: VisualRecipeType | "json"): MessageKey {
  const short = type.replace(/^minecraft:(crafting_)?/, "");
  return `recipe.types.${short}` as MessageKey;
}
