# 0013. Dynamic rendering without Cache Components; session check per segment

- **Status:** accepted
- **Date:** 2026-10-25

## Context

create-next-app 16.4 enables `cacheComponents` and `partialPrefetching`. With Cache Components, any `cookies()` read outside `<Suspense>` is a build error. But the root layout must read the theme and locale cookies to render `<html>` attributes (ADR 0011, 0012), and every page is private, per user and per request.

ADR 0004 says the root layout re-checks the session. However, `/sign-in` also renders inside the root layout, so it cannot require a session there.

## Decision

- `cacheComponents` and `partialPrefetching` are **off**. Pages render dynamically per request, and server code may read cookies anywhere.
- Defense in depth for ADR 0004 (refines its "root layout" point):
  - `src/proxy.ts` gates every request;
  - the `(app)` route-group layout and **every page** call `requireUser()`;
  - every route handler is wrapped in `apiRoute()` (`src/app/api/_lib/route.ts`), which returns 401 without an allowlisted session.
- Repo reads that a layout and its page share use request-scoped `cache()` loaders in `src/storage/index.ts` (`loadCustomMods`, `loadModpacks`).

## Consequences

- Simple mental model: no static shell and no `use cache` directives. Each navigation does a server render with GitHub reads.
- If performance needs it later, enabling Cache Components needs a new ADR and Suspense boundaries around every cookie or session read.

## Alternatives considered

- **Keep Cache Components and apply the theme with an inline script:** the locale, auth and data are request-bound anyway, so almost nothing would be static, while every component would need Suspense boundaries.
