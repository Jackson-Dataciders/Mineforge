import { compareCodeUnits } from "@/lib/stable-json";
import type { EntryStatus } from "./entry";
import type { DataSource } from "./library";

/**
 * An icon file: an extracted texture under `assets/textures/` or an entry
 * icon drawn in the pixel editor under `assets/icons/`.
 */
export type IconRef = { kind: "texture" | "icon"; path: string };

/** What the item search modal shows per item (names are always English). */
export type SearchItem = {
  id: string;
  name: string;
  icon: IconRef | null;
  /** Library data source, or `entry` for a custom mod entry. */
  source: DataSource | "entry";
  /** Only for entries. */
  status?: EntryStatus;
  /** Set by the designer for an ID that is not in the item set (ADR 0021). */
  missing?: true;
  /** Display name of the mod (or "Minecraft"). */
  modName: string;
};

export type SearchSet = { items: SearchItem[]; tags: string[] };

export const SEARCH_LIMIT = 50;

const WORD_SPLIT = /[\s_:/.-]+/;

/** Score of one query token against one text; 0 = no match. */
function tokenScore(token: string, text: string): number {
  if (text === token) return 1000;
  if (text.startsWith(token)) return 800;
  if (text.split(WORD_SPLIT).some((word) => word.startsWith(token))) return 600;
  if (text.includes(token)) return 400;
  // Subsequence: every character in order; tighter matches score higher.
  let pos = -1;
  let gaps = 0;
  for (const char of token) {
    const next = text.indexOf(char, pos + 1);
    if (next === -1) return 0;
    if (pos >= 0) gaps += next - pos - 1;
    pos = next;
  }
  return Math.max(1, 200 - gaps * 5);
}

/** Fuzzy score of a query against several texts (name, ID, …); 0 = no match. */
export function fuzzyScore(query: string, texts: readonly string[]): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const lowered = texts.map((t) => t.toLowerCase());
  const whole = Math.max(...lowered.map((t) => tokenScore(q, t)));
  const parts = q.split(/\s+/);
  if (parts.length === 1) return whole;
  let sum = 0;
  for (const part of parts) {
    const best = Math.max(...lowered.map((t) => tokenScore(part, t)));
    if (best === 0) return whole;
    sum += best;
  }
  return Math.max(whole, sum / parts.length);
}

function rank<T>(
  entries: readonly T[],
  query: string,
  texts: (entry: T) => string[],
  label: (entry: T) => string,
  limit: number,
): T[] {
  return entries
    .map((entry) => ({ entry, score: fuzzyScore(query, texts(entry)) }))
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        label(a.entry).length - label(b.entry).length ||
        compareCodeUnits(label(a.entry), label(b.entry)),
    )
    .slice(0, limit)
    .map((r) => r.entry);
}

/** Best matches by English name and ID; an empty query lists by name. */
export function searchItems(
  items: readonly SearchItem[],
  query: string,
  limit = SEARCH_LIMIT,
): SearchItem[] {
  if (!query.trim()) {
    return [...items]
      .sort(
        (a, b) =>
          compareCodeUnits(a.name, b.name) || compareCodeUnits(a.id, b.id),
      )
      .slice(0, limit);
  }
  return rank(
    items,
    query,
    (i) => [i.name, i.id],
    (i) => i.name,
    limit,
  );
}

export function searchTags(
  tags: readonly string[],
  query: string,
  limit = SEARCH_LIMIT,
): string[] {
  const q = query.trim().replace(/^#/, "");
  if (!q) return [...tags].sort(compareCodeUnits).slice(0, limit);
  return rank(
    tags,
    q,
    (t) => [t],
    (t) => t,
    limit,
  );
}
