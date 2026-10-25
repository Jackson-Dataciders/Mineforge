# 0011. Theming with semantic tokens from one source

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The app has three themes (`moss`, `lantern`, `deepslate-emerald`), each with a light and a dark variant, plus a `system` mode. Colors must stay consistent across all six variants, and new themes should be addable in one place. The palettes avoid pure white and black for long sessions. Every text/background pair used must meet WCAG AA. The choice is persisted per device and must apply before first paint.

## Decision

- **One source:** `src/theme/tokens.ts` holds every palette as semantic tokens:
  - `bg, surface, border, text, muted, accent, on-accent, secondary, ok, slot, danger, warning`
  - It also holds the theme IDs, display names (proper names; English in every UI language) and cookie names.
- **CSS:** the root layout inlines CSS custom properties from `renderThemeCss()`, one rule per `[data-theme][data-mode]`.
  - `data-mode` is `light | dark | system`; `system` switches via `@media (prefers-color-scheme: dark)`, so no JavaScript is needed.
  - The selectors also work on any element, so the theme picker previews other themes with tokens, not raw colors.
- **Tailwind:** `globals.css` maps the tokens through `@theme inline` and removes the default palette (`--color-*: initial`).
  - Components use only token classes (`bg-surface`, `text-muted`, …).
  - Tints are `bg-<role>/13`, the role color at 13 % over the surface.
  - ESLint rejects hex and color functions in `src/app` and `src/components`.
- **Persistence:** cookies `mf-theme` and `mf-mode` (1 year, per device). The server renders them as attributes on `<html>`, so there is no flash and no inline script. The picker updates the attribute and the cookie immediately.
- **Usage policy** (what the contrast test checks):
  - `text` and `muted` on `bg`, `surface`, `slot` and every tint;
  - `on-accent` on `accent`;
  - `danger` as error text on `bg`/`surface`;
  - all role colors (`accent, secondary, ok, muted, danger, warning`) as icons, outlines and focus rings at 3:1 against `bg`, `surface` and `slot`, and against their own tint.
  - `border` is decorative only; controls are identified by labels, background and the accent focus ring.
  - Any new pair must be added to `src/theme/tokens.test.ts` first.
- **Status mapping** (from phase 4): backlog = `muted`, planned = `secondary`, implemented = `ok`.

### Contrast adjustments (lightness only, minimal)

| Variant                 | Token     | Brief   | Used    | Failing pair                                      |
| ----------------------- | --------- | ------- | ------- | ------------------------------------------------- |
| moss light              | muted     | #626D58 | #5F6A56 | muted on tints (4.36–4.47)                        |
| moss light              | accent    | #4C8A2E | #49842C | on-accent (#FFFFFF) on accent (4.22)              |
| lantern light           | muted     | #6F6A5F | #6B665B | muted on slot/tints (4.30–4.41)                   |
| lantern light           | accent    | #D9A441 | #AC7C22 | accent outline on bg/surface/slot (1.84–2.12 < 3) |
| lantern light           | on-accent | #2B2110 | #241C0E | on-accent on the darker accent                    |
| lantern dark            | muted     | #A49C8E | #A59D8F | muted on tints (4.45–4.49)                        |
| deepslate-emerald light | accent    | #2F8A6E | #2D8469 | on-accent (#FFFFFF) on accent (4.22)              |
| deepslate-emerald dark  | muted     | #9C9C96 | #9D9D97 | muted on tints (4.45–4.48)                        |

### Derived `danger` / `warning`

These are muted, low-glare hues, chosen per variant to stay distinct from that variant's accent, secondary and ok:

| Variant                        | danger            | warning           |
| ------------------------------ | ----------------- | ----------------- |
| moss light / dark              | #BA4941 / #DA6961 | #9D8216 / #D6BC51 |
| lantern light / dark           | #BD4353 / #DB6474 | #D06538 / #D67951 |
| deepslate-emerald light / dark | #B74D3D / #D86958 | #AE7C19 / #D6AA51 |

## Consequences

- A new theme means one palette entry in `tokens.ts`, plus the contrast test passing; nothing else changes.
- The Lantern light accent is a darker ochre than the brief's amber, because selected-slot outlines must reach 3:1.
- Reading the cookies makes the root layout dynamic (ADR 0013).

## Alternatives considered

- **Inline blocking script reading localStorage** (next-themes style): it works with a static shell, but needs `suppressHydrationWarning` and duplicate logic. Cookies plus SSR are simpler once rendering is dynamic anyway.
- **Hand-written CSS per theme:** it would duplicate values that the contrast test then could not see.
