"use client";

import "@xyflow/react/dist/base.css";
import {
  Background,
  MarkerType,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import { LayoutGrid, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useApiFailure } from "@/components/ui/use-api-failure";
import { splitEntryId } from "@/domain/entry-id";
import { entryIconPath } from "@/domain/item-sources";
import type { IconRef } from "@/domain/item-search";
import {
  DEFAULT_MAP_FILTERS,
  filterMindMap,
  NODE_SIZE,
  placeUnpositioned,
  type Layout,
  type MindMap as MindMapGraph,
  type Position,
  type Positions,
} from "@/domain/mind-map";
import { useT } from "@/i18n/client";
import { fetchJson } from "@/lib/fetch-json";
import { edgeLook } from "./edge-look";
import { layoutWithElk } from "./elk-layout";
import {
  edgeKindLabel,
  MapFilterPanel,
  readMapFilters,
  subscribeMapFilters,
} from "./map-filters";
import {
  NODE_HANDLES,
  NODE_TYPES,
  type EntryFlowNode,
  type ItemFlowNode,
} from "./map-nodes";
import { createSaveQueue } from "./save-queue";

/** What the page knows about an outside item (name and icon from the item set). */
export type OutsideItem = {
  name: string;
  icon: IconRef | null;
  modName: string | null;
  missing: boolean;
};

type VersionedLayout = { data: Layout; sha: string | null };
type FlowNode = EntryFlowNode | ItemFlowNode;

const SAVE_DELAY_MS = 800;
/** Fit the map, but never zoom small graphs beyond 100 %. */
const FIT_VIEW = { padding: 0.1, maxZoom: 1 };

/**
 * One node object per base node and position: while one node is dragged,
 * the others keep their objects, so xyflow doesn't re-render them.
 */
const positioned = new WeakMap<FlowNode, FlowNode>();
function withPosition(base: FlowNode, position: Position): FlowNode {
  const cached = positioned.get(base);
  if (
    cached &&
    cached.position.x === position.x &&
    cached.position.y === position.y
  ) {
    return cached;
  }
  const node = { ...base, position };
  positioned.set(base, node);
  return node;
}

/**
 * The custom mod's mind map (spec 06): derived nodes and edges, filters,
 * ELK auto-layout and positions saved to `layout.json` shortly after a drag.
 */
export function MindMap(props: {
  modId: string;
  modName: string;
  map: MindMapGraph;
  items: Record<string, OutsideItem>;
  initialLayout: VersionedLayout;
}) {
  return (
    <ReactFlowProvider>
      <MindMapCanvas {...props} />
    </ReactFlowProvider>
  );
}

function MindMapCanvas({
  modId,
  modName,
  map,
  items,
  initialLayout,
}: {
  modId: string;
  modName: string;
  map: MindMapGraph;
  items: Record<string, OutsideItem>;
  initialLayout: VersionedLayout;
}) {
  const t = useT();
  const fail = useApiFailure();
  const flow = useReactFlow();
  const filters = useSyncExternalStore(
    subscribeMapFilters,
    readMapFilters,
    () => DEFAULT_MAP_FILTERS,
  );
  const visible = useMemo(() => filterMindMap(map, filters), [map, filters]);
  // Entries hidden by the filters; outside items are counted apart.
  const countEntries = (m: MindMapGraph) =>
    m.nodes.filter((n) => n.kind === "entry").length;
  const hiddenCount = countEntries(map) - countEntries(visible);

  /** Stored and dragged positions; the source of truth for saving. */
  const [positions, setPositions] = useState<Positions>(
    initialLayout.data.positions,
  );
  /** ELK positions for a map without any stored position (not saved). */
  const [computed, setComputed] = useState<Positions | null>(null);
  const [relayoutOpen, setRelayoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const needsLayout =
    visible.nodes.length > 0 &&
    visible.nodes.every((n) => !positions[n.id]) &&
    !visible.nodes.every((n) => computed?.[n.id]);
  const visibleKey = visible.nodes.map((n) => n.id).join("|");

  useEffect(() => {
    if (!needsLayout) return;
    let active = true;
    layoutWithElk(visible)
      .catch(() => {
        // ELK failed: fall back to the simple column placement.
        if (active) fail("unknown");
        return placeUnpositioned(visible.nodes, {});
      })
      .then((result) => {
        if (!active) return;
        setComputed(result);
        requestAnimationFrame(() => void flow.fitView(FIT_VIEW));
      });
    return () => {
      active = false;
    };
    // `visibleKey` stands for `visible`'s nodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsLayout, visibleKey, flow, fail]);

  const shown = useMemo(
    () =>
      placeUnpositioned(visible.nodes, { ...(computed ?? {}), ...positions }),
    [visible.nodes, computed, positions],
  );

  // Everything but the position; rebuilt only when the graph changes.
  const baseNodes: FlowNode[] = useMemo(
    () =>
      visible.nodes.map((n): FlowNode => {
        const origin = { x: 0, y: 0 };
        if (n.kind === "entry") {
          return {
            id: n.id,
            type: "entry",
            position: origin,
            ...NODE_SIZE.entry,
            measured: NODE_SIZE.entry,
            handles: NODE_HANDLES.entry,
            data: {
              entry: n.entry,
              icon: n.icon ? { kind: "icon", path: entryIconPath(n.id) } : null,
              href: `/designer/${modId}/entries/${splitEntryId(n.id).path}`,
            },
          };
        }
        const item = items[n.id];
        return {
          id: n.id,
          type: "item",
          position: origin,
          ...NODE_SIZE.item,
          measured: NODE_SIZE.item,
          handles: NODE_HANDLES.item,
          data: {
            name: item?.name ?? n.id,
            icon: item?.icon ?? null,
            modName: item?.modName ?? null,
            missing: item?.missing ?? true,
          },
        };
      }),
    [visible.nodes, items, modId],
  );

  const nodes = useMemo(
    () => baseNodes.map((b) => withPosition(b, shown[b.id] ?? { x: 0, y: 0 })),
    [baseNodes, shown],
  );

  const edges: Edge[] = useMemo(
    () =>
      visible.edges.map((e) => {
        const look = edgeLook(e.kind, e.derived);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label:
            e.kind === "ingredient_of"
              ? undefined
              : (e.label ?? edgeKindLabel(e.kind, t)),
          style: { stroke: look.stroke, strokeDasharray: look.dash },
          markerEnd: { type: MarkerType.ArrowClosed, color: look.stroke },
          labelStyle: { fill: "var(--text)", fontSize: 12 },
          labelBgStyle: { fill: "var(--surface)" },
          labelBgPadding: [4, 2] as [number, number],
          focusable: false,
        };
      }),
    [visible.edges, t],
  );

  /** Node names for the screen-reader list of edges. */
  const nameOf = useCallback(
    (id: string) => {
      const node = map.nodes.find((n) => n.id === id);
      return node?.kind === "entry" ? node.entry.name : (items[id]?.name ?? id);
    },
    [map.nodes, items],
  );

  // Autosave: one request at a time; moves during a save are sent next.
  const url = `/api/custom-mods/${modId}/layout`;
  const shaRef = useRef(initialLayout.sha);
  const latestRef = useRef(positions);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failRef = useRef(fail);
  useEffect(() => {
    failRef.current = fail;
  }, [fail]);
  const queueRef = useRef<ReturnType<typeof createSaveQueue<Positions>> | null>(
    null,
  );
  useEffect(() => {
    queueRef.current = createSaveQueue<Positions>(async (value) => {
      const result = await fetchJson<VersionedLayout>(url, {
        method: "PUT",
        body: { positions: value, sha: shaRef.current },
      });
      if (!result.ok) {
        failRef.current(result.error);
        return false;
      }
      shaRef.current = result.data.sha;
      return true;
    });
  }, [url]);

  const saveNow = useCallback((next: Positions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    latestRef.current = next;
    void queueRef.current?.save(next);
  }, []);

  const scheduleSave = useCallback((next: Positions) => {
    latestRef.current = next;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void queueRef.current?.save(latestRef.current);
    }, SAVE_DELAY_MS);
  }, []);

  // A move still waiting for its timer is sent when the page goes away.
  useEffect(() => {
    const sendPending = () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      void fetch(url, {
        method: "PUT",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          positions: latestRef.current,
          sha: shaRef.current,
        }),
      });
    };
    window.addEventListener("pagehide", sendPending);
    return () => {
      window.removeEventListener("pagehide", sendPending);
      sendPending();
    };
  }, [url]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    const moved: Positions = {};
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        moved[change.id] = change.position;
      }
    }
    if (Object.keys(moved).length > 0) {
      setPositions((p) => ({ ...p, ...moved }));
    }
  }, []);

  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: FlowNode, dragged: FlowNode[]) => {
      // Final positions come from xyflow, not from the last render.
      const moved = Object.fromEntries(dragged.map((n) => [n.id, n.position]));
      // Save what is shown too, so placed and ELK-computed nodes are kept.
      const next = { ...latestRef.current, ...shownRef.current, ...moved };
      setPositions(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  async function relayout() {
    setBusy(true);
    try {
      const result = await layoutWithElk(visible);
      const next = { ...latestRef.current, ...positions, ...result };
      setPositions(next);
      saveNow(next);
      requestAnimationFrame(() => void flow.fitView(FIT_VIEW));
    } catch {
      fail("unknown");
    } finally {
      setBusy(false);
      setRelayoutOpen(false);
    }
  }

  const laidOut = !needsLayout;
  const a11y = {
    "node.a11yDescription.default": t("mindMap.a11y.node"),
    "node.a11yDescription.keyboardDisabled": t("mindMap.a11y.node"),
    "node.a11yDescription.ariaLiveMessage": ({
      x,
      y,
    }: {
      direction: string;
      x: number;
      y: number;
    }) => t("mindMap.a11y.moved", { x: Math.round(x), y: Math.round(y) }),
    "edge.a11yDescription.default": t("mindMap.a11y.edge"),
  };

  return (
    <div className="flex flex-col gap-3">
      <MapFilterPanel filters={filters} hiddenCount={hiddenCount} />
      <div
        className="mf-map relative h-[calc(100dvh-15rem)] min-h-96 overflow-hidden rounded-lg border border-border"
        aria-label={t("mindMap.label", { name: modName })}
        role="region"
      >
        {map.nodes.length === 0 || visible.nodes.length === 0 ? (
          <p className="p-4 text-muted">
            {map.nodes.length === 0
              ? t("mindMap.noEntries")
              : t("mindMap.empty")}
          </p>
        ) : (
          <ReactFlow<FlowNode, Edge>
            nodes={laidOut ? nodes : []}
            edges={laidOut ? edges : []}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            nodesConnectable={false}
            elementsSelectable={false}
            ariaLabelConfig={a11y}
            fitView
            fitViewOptions={FIT_VIEW}
            minZoom={0.1}
          >
            <Background gap={24} />
            {!laidOut && (
              <Panel position="top-center">
                <p className="rounded-md bg-surface px-3 py-2 text-sm text-muted">
                  {t("mindMap.layingOut")}
                </p>
              </Panel>
            )}
            <Panel position="top-right">
              <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
                <IconButton
                  label={t("mindMap.zoomIn")}
                  onClick={() => void flow.zoomIn()}
                >
                  <ZoomIn className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={t("mindMap.zoomOut")}
                  onClick={() => void flow.zoomOut()}
                >
                  <ZoomOut className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={t("mindMap.fit")}
                  onClick={() => void flow.fitView(FIT_VIEW)}
                >
                  <Maximize className="size-4" aria-hidden />
                </IconButton>
                <Button onClick={() => setRelayoutOpen(true)} disabled={busy}>
                  <LayoutGrid className="size-4" aria-hidden />
                  {t("mindMap.relayout")}
                </Button>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>
      {/* The edges as text, since the drawn edges can't be read out. */}
      <section className="sr-only" aria-label={t("mindMap.edgeList")}>
        <ul>
          {visible.edges.map((e) => (
            <li key={e.id}>
              {t("mindMap.edgeItem", {
                source: nameOf(e.source),
                kind: e.label ?? edgeKindLabel(e.kind, t),
                target: nameOf(e.target),
              })}
            </li>
          ))}
        </ul>
      </section>
      <Dialog
        open={relayoutOpen}
        onClose={() => setRelayoutOpen(false)}
        title={t("mindMap.relayoutTitle")}
      >
        <p className="text-sm">{t("mindMap.relayoutConfirm")}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setRelayoutOpen(false)} disabled={busy}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => void relayout()}
            disabled={busy}
          >
            {t("mindMap.relayout")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
