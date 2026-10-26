"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  SEARCH_LIMIT,
  searchItems,
  searchTags,
  type SearchItem,
} from "@/domain/item-search";
import { useT } from "@/i18n/client";
import { StatusIcon } from "@/components/designer/status-icon";
import { ItemIcon } from "./item-icon";

export type ItemSelection =
  { kind: "item"; item: SearchItem } | { kind: "tag"; tag: string };

/**
 * Shared item search modal (spec 03): fuzzy search by English name and ID,
 * capped results, icons, mod name and an "inferred" badge. Optionally lets
 * the user pick an item tag instead, or empty the slot.
 */
export function ItemSearchDialog({
  open,
  onClose,
  title,
  items,
  tags = [],
  allowTags = false,
  onSelect,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: readonly SearchItem[];
  tags?: readonly string[];
  allowTags?: boolean;
  onSelect: (selection: ItemSelection) => void;
  /** If given, an "Empty this slot" button is shown. */
  onClear?: () => void;
}) {
  const t = useT();
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"items" | "tags">("items");
  const deferred = useDeferredValue(query);
  const showTags = allowTags && mode === "tags";

  const itemResults = useMemo(
    () => (showTags ? [] : searchItems(items, deferred, SEARCH_LIMIT + 1)),
    [items, deferred, showTags],
  );
  const tagResults = useMemo(
    () => (showTags ? searchTags(tags, deferred, SEARCH_LIMIT + 1) : []),
    [tags, deferred, showTags],
  );
  const count = showTags ? tagResults.length : itemResults.length;

  const choose = (selection: ItemSelection) => {
    onSelect(selection);
    setQuery("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t("itemSearch.label")}
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("itemSearch.placeholder")}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 rounded-md border border-border bg-bg px-3 text-base text-text"
          />
        </div>

        {allowTags && (
          <div
            role="radiogroup"
            aria-label={t("itemSearch.label")}
            className="flex rounded-lg border border-border p-0.5"
          >
            {(["items", "tags"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className="min-h-11 flex-1 rounded-md px-3 text-sm font-medium text-muted aria-checked:bg-accent/13 aria-checked:text-text"
              >
                {t(`itemSearch.${value}`)}
              </button>
            ))}
          </div>
        )}

        {onClear && (
          <Button
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            {t("itemSearch.clearSlot")}
          </Button>
        )}

        <ul className="flex flex-col">
          {showTags
            ? tagResults.slice(0, SEARCH_LIMIT).map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => choose({ kind: "tag", tag })}
                    className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-accent/13"
                  >
                    <ItemIcon icon={null} kind="tag" size={32} />
                    <span className="font-mono text-sm break-all">#{tag}</span>
                  </button>
                </li>
              ))
            : itemResults.slice(0, SEARCH_LIMIT).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => choose({ kind: "item", item })}
                    className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-accent/13"
                  >
                    <ItemIcon icon={item.icon} size={32} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-x-2">
                        <span className="font-medium">{item.name}</span>
                        {item.status && <StatusIcon status={item.status} />}
                        {item.source === "inferred" && <InferredBadge />}
                      </span>
                      <span className="truncate text-xs text-muted">
                        <span className="font-mono">{item.id}</span> ·{" "}
                        {item.modName}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
        </ul>
        {count === 0 && (
          <p className="text-sm text-muted">{t("itemSearch.noResults")}</p>
        )}
        {count > SEARCH_LIMIT && (
          <p className="text-sm text-muted">
            {t("itemSearch.capped", { count: SEARCH_LIMIT })}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** Marks inferred library data, which may be wrong (glossary: Inferred data). */
export function InferredBadge() {
  const t = useT();
  return (
    <span className="rounded-full bg-secondary/13 px-2 text-xs text-text">
      {t("badges.inferred")}
    </span>
  );
}
