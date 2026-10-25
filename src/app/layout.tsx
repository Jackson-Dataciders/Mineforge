import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/i18n/client";
import { getLocale, getT } from "@/i18n/server";
import { renderThemeCss } from "@/theme/render-css";
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  isColorMode,
  isThemeId,
  MODE_COOKIE,
  THEME_COOKIE,
} from "@/theme/tokens";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("app.name"), robots: { index: false, follow: false } };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const THEME_CSS = renderThemeCss();

/**
 * Root layout. Theme, mode and locale come from per-device cookies and are
 * rendered on <html>, so the first paint is already correct (ADR 0011, 0012).
 * The session check lives in the (app) layout, because /sign-in also uses
 * this layout (ADR 0013).
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get(THEME_COOKIE)?.value;
  const modeCookie = cookieStore.get(MODE_COOKIE)?.value;
  const theme = isThemeId(themeCookie) ? themeCookie : DEFAULT_THEME;
  const mode = isColorMode(modeCookie) ? modeCookie : DEFAULT_MODE;
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      data-theme={theme}
      data-mode={mode}
      className="h-full antialiased"
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
