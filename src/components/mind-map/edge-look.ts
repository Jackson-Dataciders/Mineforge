import type { MapEdgeKind } from "@/domain/mind-map";

/**
 * Edge colors and dashes (theme tokens only, ADR 0011): recipes muted,
 * manual relations accent, links implied by entry data secondary and dashed.
 * All are role colors on `bg`, a tested 3:1 pair.
 */
export function edgeLook(
  kind: MapEdgeKind,
  derived: boolean,
): { stroke: string; dash: string | undefined } {
  if (kind === "ingredient_of")
    return { stroke: "var(--muted)", dash: undefined };
  if (kind === "made_in" || kind === "involved_in" || derived) {
    return { stroke: "var(--secondary)", dash: "6 4" };
  }
  return { stroke: "var(--accent)", dash: undefined };
}
