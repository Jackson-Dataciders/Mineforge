import { de } from "./messages/de";
import { en } from "./messages/en";
import type { MessageKey, Messages, MessageVars, Translate } from "./types";

export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Cookie holding the chosen locale; persisted per device (ADR 0012). */
export const LOCALE_COOKIE = "mf-locale";

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const catalogs: Record<Locale, Messages> = { en, de };

/** Cookie value if valid, otherwise German if the browser prefers it over English. */
export function resolveLocale(
  cookie: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(cookie)) return cookie;
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((p) => isLocale(p.lang))
    .sort((a, b) => b.q - a.q)[0]?.lang;
  return isLocale(preferred) ? preferred : DEFAULT_LOCALE;
}

export function createTranslator(messages: Messages): Translate {
  return (key: MessageKey, vars?: MessageVars) => {
    let node: unknown = messages;
    for (const part of key.split(".")) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (typeof node !== "string") return key;
    return vars
      ? node.replace(/\{(\w+)\}/g, (m, name: string) => String(vars[name] ?? m))
      : node;
  };
}
