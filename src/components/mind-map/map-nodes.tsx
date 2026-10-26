"use client";

import {
  Handle,
  Position,
  type Node,
  type NodeHandle,
  type NodeProps,
} from "@xyflow/react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { StatusIcon } from "@/components/designer/status-icon";
import { ItemIcon } from "@/components/items/item-icon";
import type { EntrySummary } from "@/domain/entry";
import type { IconRef } from "@/domain/item-search";
import { NODE_SIZE } from "@/domain/mind-map";
import { useT } from "@/i18n/client";

export type EntryNodeData = {
  entry: EntrySummary;
  icon: IconRef | null;
  href: string;
};
export type ItemNodeData = {
  name: string;
  icon: IconRef | null;
  modName: string | null;
  missing: boolean;
};
export type EntryFlowNode = Node<EntryNodeData, "entry">;
export type ItemFlowNode = Node<ItemNodeData, "item">;

// Edges attach left (incoming) and right (outgoing); the handles are only
// anchors, since edges can't be drawn on the map.
const handles = (
  <>
    <Handle
      type="target"
      position={Position.Left}
      isConnectable={false}
      className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"
    />
    <Handle
      type="source"
      position={Position.Right}
      isConnectable={false}
      className="!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent"
    />
  </>
);

/** An entry of the mod: icon, name, type, status and a link to its form. */
export function EntryNode({ data }: NodeProps<EntryFlowNode>) {
  const t = useT();
  const { entry } = data;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-border bg-surface pr-1 pl-2 text-text"
      style={NODE_SIZE.entry}
    >
      {handles}
      <ItemIcon icon={data.icon} size={32} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{entry.name}</span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <StatusIcon status={entry.status} />
          {t(`entryTypes.${entry.type}`)}
        </span>
      </div>
      <Link
        href={data.href}
        aria-label={t("mindMap.open", { name: entry.name })}
        title={t("mindMap.open", { name: entry.name })}
        className="nodrag inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-accent/13"
      >
        <ExternalLink className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

/** An item outside the mod, used as an ingredient. */
export function ItemNode({ data }: NodeProps<ItemFlowNode>) {
  const t = useT();
  return (
    <div
      className={`flex items-center gap-2 rounded-md bg-surface px-2 text-text ${
        data.missing ? "border-2 border-danger" : "border border-border"
      }`}
      style={NODE_SIZE.item}
    >
      {handles}
      <ItemIcon icon={data.icon} size={24} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium">{data.name}</span>
        {data.missing ? (
          <span className="truncate text-xs text-danger">
            {t("mindMap.missingItem")}
          </span>
        ) : (
          data.modName && (
            <span className="truncate text-xs text-muted">{data.modName}</span>
          )
        )}
      </div>
    </div>
  );
}

export const NODE_TYPES = { entry: EntryNode, item: ItemNode };

/**
 * Handle positions for a fixed-size node. Given up front, edges don't wait
 * for xyflow to measure the handles in the DOM.
 */
function fixedHandles(size: { width: number; height: number }): NodeHandle[] {
  const y = size.height / 2 - 2;
  return [
    { type: "target", position: Position.Left, x: 0, y, width: 4, height: 4 },
    {
      type: "source",
      position: Position.Right,
      x: size.width - 4,
      y,
      width: 4,
      height: 4,
    },
  ];
}

export const NODE_HANDLES = {
  entry: fixedHandles(NODE_SIZE.entry),
  item: fixedHandles(NODE_SIZE.item),
};
