"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import { catalogs, createTranslator, type Locale } from "./locale";
import type { Translate } from "./types";

const I18nContext = createContext<{ locale: Locale; t: Translate } | null>(
  null,
);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: createTranslator(catalogs[locale]) }),
    [locale],
  );
  return <I18nContext value={value}>{children}</I18nContext>;
}

function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error("useT must be used inside <I18nProvider>");
  return value;
}

/** Translator for client components. */
export const useT = () => useI18n().t;
export const useLocale = () => useI18n().locale;
