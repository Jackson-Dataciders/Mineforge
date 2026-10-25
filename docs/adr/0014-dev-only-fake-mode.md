# 0014. Dev-only fake mode for local verification

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Running the app for real needs a GitHub OAuth app, a GitHub App installation and their secrets. Local checks in a browser (including by Claude Code sessions, which cannot read `.env*` files) must be possible without them and without writing test commits to `main`.

## Decision

- `isDevFakeMode()` (`src/server/dev-fake.ts`) is true only if **all** of these hold:
  - `MINEFORGE_DEV_FAKE=1`
  - `NODE_ENV=development`
  - `VERCEL` is unset

  A unit test covers this.

- In fake mode:
  - `src/proxy.ts` skips Auth.js and allows every request;
  - `getAllowedUser()` returns a fixed fake user;
  - `getStorage()` returns the in-memory backend, seeded with a sample custom mod, a modpack and a texture (`src/storage/dev-seed.ts`), which lives on `globalThis` until the dev server stops.
- `.claude/launch.json` has a `dev-fake` configuration that sets the flag.

## Consequences

- The full UI can be tried locally with conflict handling identical to production, because the memory backend has the same semantics.
- The fake store survives hot reloads with old class instances, so storage errors are recognized by name (`isConflictError` …), not with `instanceof`.
- Production builds can never enter fake mode: `next build`/`start` set `NODE_ENV=production`, and Vercel sets `VERCEL`.

## Alternatives considered

- **Real credentials in `.env.local`:** every test write would become a commit on `main`, and Claude Code sessions can't read the file.
- **Tests and build only:** UI, theming and phone layout would stay unverified.
