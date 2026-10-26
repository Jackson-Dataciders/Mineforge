# 0004. Auth.js with GitHub login, allowlisted to one GitHub user ID

- **Status:** accepted (where the session is re-checked is refined by [0013](0013-dynamic-rendering-session-checks.md))
- **Date:** 2026-10-25

## Context

The deployed app is reachable on the public internet but serves licensed content and private data for exactly one person.

## Decision

- Login uses Auth.js with the GitHub provider. Access is granted only if the GitHub **numeric user ID** equals `ALLOWED_GITHUB_USER_ID`. Login names can change, so they are not checked.
- `src/proxy.ts` (Next.js 16's replacement for `middleware.ts`) enforces this on every page and API route. Only the Auth.js sign-in and callback routes are excluded.
- Every route handler and the root layout also check the session (`requireUser()` in `src/server/`). A proxy-only check is not trusted on its own.
- Textures and icons are never placed in `public/`, which Next.js serves without auth. They are served by an authenticated route (`/api/textures/[...path]`) that reads them through the storage layer, with `Cache-Control: private`.

## Consequences

- A request without a valid session gets a redirect (pages) or 401 (API) before any data access.
- New routes are protected by default; there is no "public" route to forget about.
- Auth.js v5 for the App Router was in beta (`next-auth@5.0.0-beta.x`) when this was decided. The auth phase must check its current status and Next.js 16 compatibility.

## Alternatives considered

None were listed when the decision was made.
