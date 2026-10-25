# 0012. i18n with a typed in-repo catalog, locale in a cookie

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The UI is in English and German, switchable and persisted per device. Only UI strings are translated; user content and Minecraft names never are. There is no locale-specific routing, SEO or pluralization-heavy text.

## Decision

- `src/i18n/messages/en.ts` (`as const`) is the source of truth. `de.ts` is typed as `Messages`, so a missing or extra key is a type error.
- Keys are dot paths (`projects.customMod.create`), typed as `MessageKey`. Placeholders use `{name}`.
- **Server:** `getT()` (`src/i18n/server.ts`). **Client:** `useT()` / `useLocale()` from `I18nProvider` (`src/i18n/client.tsx`), which the root layout sets up.
- The locale is stored in the `mf-locale` cookie (1 year). Without the cookie, `Accept-Language` decides (German if preferred over English, otherwise English). `<html lang>` follows the locale.
- Switching sets the cookie and calls `router.refresh()`.
- `src/i18n/locale.test.ts` checks key parity, non-empty values and identical placeholders.

## Consequences

- No i18n dependency; both catalogs ship to the client (small).
- Plurals and number or date formatting, if needed later, use `Intl` APIs next to `t()`.
- New UI strings must be added to both files in the same change.

## Alternatives considered

- **next-intl:** locale routing and ICU messages aren't needed, and the library adds compatibility risk with Next.js 16.4's defaults.
- **Locale in localStorage:** the server could not render the right language on first paint.
