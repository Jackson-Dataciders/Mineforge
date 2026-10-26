import { NODE_SIZE, type MindMap, type Positions } from "@/domain/mind-map";

/**
 * Lays out the map with ELK's layered algorithm, left to right (spec 06).
 * ELK is loaded on demand, so the page doesn't ship it until it's needed.
 */
export async function layoutWithElk(map: MindMap): Promise<Positions> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const result = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "32",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
    },
    children: map.nodes.map((n) => ({ id: n.id, ...NODE_SIZE[n.kind] })),
    edges: map.edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  });
  return Object.fromEntries(
    (result.children ?? []).map((c) => [
      c.id,
      { x: Math.round(c.x ?? 0), y: Math.round(c.y ?? 0) },
    ]),
  );
}
