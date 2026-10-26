import { z } from "zod";
import type { CustomRecipeType } from "./custom-recipe";
import {
  ENTRY_STATUSES,
  ENTRY_TYPES,
  isItemEntry,
  RELATION_TYPES,
  recipeIngredientItems,
  summarizeEntry,
  type Entry,
  type EntryStatus,
  type EntrySummary,
  type EntryType,
} from "./entry";

/**
 * The mind map of a custom mod (spec 06, ADR 0023). Nodes and edges are
 * derived from the entries; only node positions are stored
 * (`data/custom-mods/<modid>/layout.json`).
 */

/** Edge kinds: recipes, manual relation types, and links the entries imply. */
export const MAP_EDGE_KINDS = [
  "ingredient_of",
  ...RELATION_TYPES,
  "made_in",
  "involved_in",
] as const;
export type MapEdgeKind = (typeof MAP_EDGE_KINDS)[number];

/** Fixed node sizes, so the layout needs no measuring. */
export const NODE_SIZE = {
  entry: { width: 208, height: 64 },
  item: { width: 176, height: 48 },
} as const;

export type MapNode =
  | { kind: "entry"; id: string; entry: EntrySummary; icon: boolean }
  /** An item outside the mod (vanilla, library or missing), used as ingredient. */
  | { kind: "item"; id: string };

export type MapEdge = {
  id: string;
  kind: MapEdgeKind;
  source: string;
  target: string;
  /** The label of a custom relation. */
  label: string | null;
  /** Implied by entry data rather than a manual relation. */
  derived: boolean;
};

export type MindMap = { nodes: MapNode[]; edges: MapEdge[] };

export function buildMindMap(
  entries: readonly Entry[],
  recipeTypes: readonly CustomRecipeType[],
): MindMap {
  const entryIds = new Set(entries.map((e) => e.id));
  const machines = new Map(recipeTypes.map((t) => [t.id, t.machine]));
  const items = new Set<string>();
  const edges = new Map<string, MapEdge>();

  function add(
    kind: MapEdgeKind,
    source: string,
    target: string,
    derived: boolean,
    label: string | null = null,
  ) {
    if (source === target || !entryIds.has(target)) return;
    if (!entryIds.has(source)) {
      if (kind !== "ingredient_of") return;
      items.add(source);
    }
    const id = `${kind}:${label === null ? "" : `${label}:`}${source}->${target}`;
    const existing = edges.get(id);
    // A manual relation wins over the same link implied by the data.
    if (existing) existing.derived &&= derived;
    else edges.set(id, { id, kind, source, target, label, derived });
  }

  for (const entry of entries) {
    if (isItemEntry(entry)) {
      for (const recipe of entry.recipes) {
        for (const item of recipeIngredientItems(recipe)) {
          add("ingredient_of", item, entry.id, true);
        }
        if (recipe.type === "custom") {
          const machine = machines.get(recipe.recipeType);
          if (machine) add("made_in", entry.id, machine, true);
        }
      }
    }
    for (const relation of entry.relations) {
      add(
        relation.type,
        entry.id,
        relation.target,
        false,
        relation.type === "custom" ? relation.label : null,
      );
    }
    if (entry.type === "multiblock") {
      const cells = entry.layers.flat();
      if (entry.controller) cells.push(entry.controller);
      for (const cell of cells) {
        if (cell && entryIds.has(cell)) {
          add("part_of_multiblock", cell, entry.id, true);
        }
      }
    }
    if (entry.type === "mechanic") {
      for (const id of entry.involvedEntries) {
        add("involved_in", id, entry.id, true);
      }
    }
  }

  const nodes: MapNode[] = [
    ...entries.map((e): MapNode => ({
      kind: "entry",
      id: e.id,
      entry: summarizeEntry(e),
      icon: e.icon,
    })),
    ...[...items].sort().map((id): MapNode => ({ kind: "item", id })),
  ];
  return { nodes, edges: [...edges.values()] };
}

export const mindMapNodeIds = (map: MindMap) =>
  new Set(map.nodes.map((n) => n.id));

// ---------------------------------------------------------------------------
// Filters

export const mapFiltersSchema = z.strictObject({
  types: z.array(z.enum(ENTRY_TYPES)),
  statuses: z.array(z.enum(ENTRY_STATUSES)),
  edgeKinds: z.array(z.enum(MAP_EDGE_KINDS)),
  outsideItems: z.boolean(),
});
export type MapFilters = z.infer<typeof mapFiltersSchema>;

export const DEFAULT_MAP_FILTERS: MapFilters = {
  types: [...ENTRY_TYPES],
  statuses: [...ENTRY_STATUSES],
  edgeKinds: [...MAP_EDGE_KINDS],
  outsideItems: false,
};

/**
 * The visible part of the map. Edges need both ends visible; outside items
 * show only with the filter on and only while they have a visible edge.
 */
export function filterMindMap(map: MindMap, filters: MapFilters): MindMap {
  const types = new Set<EntryType>(filters.types);
  const statuses = new Set<EntryStatus>(filters.statuses);
  const kinds = new Set<MapEdgeKind>(filters.edgeKinds);
  const visible = new Set(
    map.nodes
      .filter((n) =>
        n.kind === "entry"
          ? types.has(n.entry.type) && statuses.has(n.entry.status)
          : filters.outsideItems,
      )
      .map((n) => n.id),
  );
  const edges = map.edges.filter(
    (e) => kinds.has(e.kind) && visible.has(e.source) && visible.has(e.target),
  );
  const linkedItems = new Set(edges.map((e) => e.source));
  return {
    nodes: map.nodes.filter(
      (n) => visible.has(n.id) && (n.kind === "entry" || linkedItems.has(n.id)),
    ),
    edges,
  };
}

// ---------------------------------------------------------------------------
// Layout

export type Position = { x: number; y: number };
export type Positions = Record<string, Position>;

export const MAX_LAYOUT_NODES = 2000;
const coordinate = z.int().min(-1_000_000).max(1_000_000);

/** `data/custom-mods/<modid>/layout.json` (ADR 0023). */
export const layoutSchema = z.strictObject({
  positions: z
    .record(
      z.string().min(1).max(300),
      z.strictObject({ x: coordinate, y: coordinate }),
    )
    .refine((p) => Object.keys(p).length <= MAX_LAYOUT_NODES, {
      message: "Too many positions",
    }),
});
export type Layout = z.infer<typeof layoutSchema>;

export const EMPTY_LAYOUT: Layout = { positions: {} };

const clamp = (v: number) =>
  Math.max(-1_000_000, Math.min(1_000_000, Math.round(v)));

/** Rounds positions and keeps only IDs that are nodes of the map. */
export function sanitizePositions(
  positions: Readonly<Record<string, Position>>,
  nodeIds: ReadonlySet<string>,
): Positions {
  const result: Positions = {};
  for (const [id, { x, y }] of Object.entries(positions)) {
    if (!nodeIds.has(id) || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    result[id] = { x: clamp(x), y: clamp(y) };
  }
  return result;
}

const sizeOf = (node: MapNode) => NODE_SIZE[node.kind];

/**
 * Positions for the given nodes: stored ones are kept; the others are
 * stacked in a column right of the stored layout, in node order.
 */
export function placeUnpositioned(
  nodes: readonly MapNode[],
  stored: Readonly<Positions>,
): Positions {
  const result: Positions = {};
  let right = -Infinity;
  let top = Infinity;
  for (const node of nodes) {
    const p = stored[node.id];
    if (!p) continue;
    result[node.id] = p;
    right = Math.max(right, p.x + sizeOf(node).width);
    top = Math.min(top, p.y);
  }
  const x = Number.isFinite(right) ? right + 80 : 0;
  let y = Number.isFinite(top) ? top : 0;
  for (const node of nodes) {
    if (result[node.id]) continue;
    result[node.id] = { x, y };
    y += sizeOf(node).height + 24;
  }
  return result;
}

/**
 * Moves positions laid out for new nodes (e.g. by ELK, starting anywhere)
 * so their top-left corner sits right of the nodes already placed, at the
 * placed nodes' top. With nothing placed, the positions are kept.
 */
export function placeBeside(
  nodes: readonly MapNode[],
  placed: Readonly<Positions>,
  laidOut: Readonly<Positions>,
): Positions {
  let right = -Infinity;
  let top = Infinity;
  for (const node of nodes) {
    const p = placed[node.id];
    if (!p) continue;
    right = Math.max(right, p.x + sizeOf(node).width);
    top = Math.min(top, p.y);
  }
  const ids = Object.keys(laidOut);
  if (!Number.isFinite(right) || ids.length === 0) return { ...laidOut };
  const minX = Math.min(...ids.map((id) => laidOut[id]!.x));
  const minY = Math.min(...ids.map((id) => laidOut[id]!.y));
  const dx = right + 80 - minX;
  const dy = top - minY;
  return Object.fromEntries(
    ids.map((id) => [id, { x: laidOut[id]!.x + dx, y: laidOut[id]!.y + dy }]),
  );
}
