function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

/**
 * Deterministic JSON for repo files: object keys sorted, 2-space indent,
 * trailing newline. Array order is kept; callers sort arrays where order
 * carries no meaning.
 */
export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

export function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(stableStringify(value));
}

export function decodeJson(content: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(content));
}
