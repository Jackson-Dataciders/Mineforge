import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  catalogs,
  createTranslator,
  LOCALE_COOKIE,
  resolveLocale,
  type Locale,
} from "./locale";

/** The request's locale from the cookie, falling back to Accept-Language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );
});

/** Translator for server components and route handlers. */
export async function getT() {
  return createTranslator(catalogs[await getLocale()]);
}
