/** Stores a per-device UI preference (theme, mode, locale) for one year. */
export function setPreferenceCookie(name: string, value: string): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax${secure}`;
}

/** Sets a `data-*` attribute on <html> (e.g. theme, mode) for an instant switch. */
export function setRootDataAttribute(
  name: "theme" | "mode",
  value: string,
): void {
  document.documentElement.dataset[name] = value;
}
