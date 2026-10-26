"use client";

import { Button } from "@/components/ui/button";
import { ENTRY_STATUSES, ENTRY_TYPES } from "@/domain/entry";
import {
  DEFAULT_MAP_FILTERS,
  MAP_EDGE_KINDS,
  mapFiltersSchema,
  type MapEdgeKind,
  type MapFilters,
} from "@/domain/mind-map";
import { useT } from "@/i18n/client";
import type { Translate } from "@/i18n/types";
import { edgeLook } from "./edge-look";

// Filters are remembered per device (spec 06).
const FILTERS_KEY = "mf-map-filters";
const listeners = new Set<() => void>();
let fallback: MapFilters = DEFAULT_MAP_FILTERS;
let cache: { raw: string | null; value: MapFilters } = {
  raw: null,
  value: DEFAULT_MAP_FILTERS,
};

export function readMapFilters(): MapFilters {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(FILTERS_KEY);
  } catch {
    return fallback; // storage blocked
  }
  if (raw === null) return fallback;
  // Same string, same object: useSyncExternalStore needs a stable snapshot.
  if (raw !== cache.raw) {
    let value = DEFAULT_MAP_FILTERS;
    try {
      const parsed = mapFiltersSchema.safeParse(JSON.parse(raw));
      if (parsed.success) value = parsed.data;
    } catch {
      // Malformed: use the defaults.
    }
    cache = { raw, value };
  }
  return cache.value;
}

export function writeMapFilters(value: MapFilters) {
  fallback = value;
  try {
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the filters last until reload.
  }
  for (const listener of listeners) listener();
}

export function subscribeMapFilters(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export const edgeKindLabel = (kind: MapEdgeKind, t: Translate) =>
  kind === "ingredient_of" || kind === "made_in" || kind === "involved_in"
    ? t(`mindMap.edges.${kind}`)
    : t(`enums.relationType.${kind}`);

function toggle<T>(list: readonly T[], value: T, on: boolean): T[] {
  return on ? [...list, value] : list.filter((v) => v !== value);
}

function Check({
  label,
  checked,
  onChange,
  sample,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  sample?: MapEdgeKind;
}) {
  // part_of_multiblock is drawn manual (solid) or derived (dashed).
  const looks = !sample
    ? []
    : sample === "part_of_multiblock"
      ? [edgeLook(sample, false), edgeLook(sample, true)]
      : [edgeLook(sample, false)];
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-accent"
      />
      {looks.map((look) => (
        <svg
          key={look.stroke}
          width="28"
          height="8"
          aria-hidden
          className="shrink-0"
        >
          <line
            x1="0"
            y1="4"
            x2="28"
            y2="4"
            style={{
              stroke: look.stroke,
              strokeWidth: 2,
              strokeDasharray: look.dash,
            }}
          />
        </svg>
      ))}
      {label}
    </label>
  );
}

/**
 * Filters for entry types, statuses, edge kinds and outside items. Collapsed
 * by default so the map gets the space on phones.
 */
export function MapFilterPanel({
  filters,
  hiddenCount,
}: {
  filters: MapFilters;
  hiddenCount: number;
}) {
  const t = useT();
  const set = (patch: Partial<MapFilters>) =>
    writeMapFilters({ ...filters, ...patch });
  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-medium">
        {t("mindMap.filters.title")}
        {hiddenCount > 0 && (
          <span className="font-normal text-muted">
            {t("mindMap.filters.hidden", { count: hiddenCount })}
          </span>
        )}
      </summary>
      <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <fieldset>
          <legend className="text-sm font-medium">
            {t("mindMap.filters.types")}
          </legend>
          {ENTRY_TYPES.map((type) => (
            <Check
              key={type}
              label={t(`entryTypeGroups.${type}`)}
              checked={filters.types.includes(type)}
              onChange={(on) => set({ types: toggle(filters.types, type, on) })}
            />
          ))}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">
            {t("mindMap.filters.statuses")}
          </legend>
          {ENTRY_STATUSES.map((status) => (
            <Check
              key={status}
              label={t(`statuses.${status}`)}
              checked={filters.statuses.includes(status)}
              onChange={(on) =>
                set({ statuses: toggle(filters.statuses, status, on) })
              }
            />
          ))}
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">
            {t("mindMap.filters.edges")}
          </legend>
          {MAP_EDGE_KINDS.map((kind) => (
            <Check
              key={kind}
              label={edgeKindLabel(kind, t)}
              sample={kind}
              checked={filters.edgeKinds.includes(kind)}
              onChange={(on) =>
                set({ edgeKinds: toggle(filters.edgeKinds, kind, on) })
              }
            />
          ))}
        </fieldset>
        <div className="flex flex-col gap-2">
          <Check
            label={t("mindMap.filters.outsideItems")}
            checked={filters.outsideItems}
            onChange={(outsideItems) => set({ outsideItems })}
          />
          <div>
            <Button onClick={() => writeMapFilters(DEFAULT_MAP_FILTERS)}>
              {t("mindMap.filters.reset")}
            </Button>
          </div>
        </div>
      </div>
    </details>
  );
}
