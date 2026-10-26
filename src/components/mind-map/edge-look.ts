import type { MapEdgeKind } from "@/domain/mind-map";

export type EdgeLook = {
  stroke: string;
  dash: string | undefined;
  width: number;
};

/** Manual relations: accent, told apart by dash pattern and width. */
const RELATION_LOOKS: Partial<Record<MapEdgeKind, EdgeLook>> = {
  drops_from: { stroke: "var(--accent)", dash: "2 4", width: 2 },
  part_of_multiblock: { stroke: "var(--accent)", dash: undefined, width: 2 },
  generated_in_structure: {
    stroke: "var(--accent)",
    dash: "10 4 2 4",
    width: 2,
  },
  powers: { stroke: "var(--accent)", dash: undefined, width: 3.5 },
  custom: { stroke: "var(--accent)", dash: "12 6", width: 2 },
};

/**
 * Edge colors, dashes and widths (theme tokens only, ADR 0011): recipes
 * muted, manual relations accent with a pattern per type, links implied by
 * entry data secondary and dashed. All are role colors on `bg`, a tested
 * 3:1 pair.
 */
export function edgeLook(kind: MapEdgeKind, derived: boolean): EdgeLook {
  if (kind === "ingredient_of") {
    return { stroke: "var(--muted)", dash: undefined, width: 1.5 };
  }
  if (kind === "made_in" || kind === "involved_in" || derived) {
    return { stroke: "var(--secondary)", dash: "6 4", width: 2 };
  }
  return (
    RELATION_LOOKS[kind] ?? {
      stroke: "var(--accent)",
      dash: undefined,
      width: 2,
    }
  );
}
