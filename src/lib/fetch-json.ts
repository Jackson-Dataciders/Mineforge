/** Result of a JSON API call: data, or the error code the route returned. */
export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string };

/** Client-side fetch for the app's route handlers. Never throws on HTTP errors. */
export async function fetchJson<T>(
  url: string,
  init: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers:
        init.body === undefined
          ? undefined
          : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: payload.error ?? "unknown",
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, status: 0, error: "unknown" };
  }
}
