# 01. Foundation

- **Status:** implemented
- **Date:** 2026-10-25
- **Related ADRs:** [0002](../adr/0002-github-repo-as-database.md), [0003](../adr/0003-private-repo-github-app.md), [0004](../adr/0004-authjs-github-allowlist.md), [0011](../adr/0011-theming-semantic-tokens.md), [0012](../adr/0012-i18n-typed-catalog.md), [0013](../adr/0013-dynamic-rendering-session-checks.md), [0014](../adr/0014-dev-only-fake-mode.md), [0015](../adr/0015-immutable-project-ids.md)

## Goal

The user can sign in with GitHub on any device, and nobody else can. The user can switch between the Mod Designer and Modpack Planner views, create, rename and delete custom mods and modpacks, and use the app in English or German with any of six theme variants. Every later phase builds on this storage layer, shell, i18n and theming.

## Scope

- Auth.js GitHub login, allowlisted to `ALLOWED_GITHUB_USER_ID`, enforced by `src/proxy.ts` for every page and API route.
- GitHub storage layer:
  - reads;
  - SHA-safe single-file writes (Contents API);
  - atomic multi-file commits (Git Data API);
  - conflict detection with a reload-and-tell UI.
- An authenticated texture route for PNGs under `assets/`.
- i18n EN/DE with a language switch, persisted per device.
- Theming: three themes × light/dark, semantic tokens only, a theme picker and a light / dark / system toggle. Persisted per device and applied before first paint.
- App shell:
  - a view switcher (Mod Designer / Modpack Planner);
  - a project selector for the current custom mod or modpack, with create, rename and delete;
  - responsive down to ~380 px.
- `.env.example` with all variables.
- A dev-only fake mode for local verification (ADR 0014).

## Out of scope

- Entries, library, uploads, recipes, tasks, mind map (phases 2–7).
- Editing a custom mod's dependencies or phase (later phases); phase 1 writes their defaults.

## Requirements

### Auth

1. GitHub is the only provider. A sign-in succeeds only if the GitHub account's numeric ID (`account.providerAccountId`) equals `ALLOWED_GITHUB_USER_ID`. Any other account sees an "access denied" message on `/sign-in`.
2. `src/proxy.ts` runs for every path except `/_next/static`, `/_next/image` and `/favicon.ico`.
   - It allows `/sign-in` and `/api/auth/*` without a session.
   - Without an allowlisted session, pages redirect to `/sign-in?callbackUrl=<path>` and `/api/*` returns `401` JSON.
3. Defense in depth (ADR 0013): the `(app)` layout, every page and every route handler re-check the session (`requireUser()` / `apiRoute()`).
4. Sessions are Auth.js JWT cookies. The session exposes the GitHub ID and display name only.

### Storage (`src/storage/`)

5. The backend interface:
   - `readFile(path)` → `{ content, sha } | null`
   - `listDir(path)` → entries
   - `listFilesRecursive(prefix)`
   - `writeFile(path, content, expectedSha | null, message)`
   - `deleteFile(path, expectedSha, message)`
   - `commit({ message, changes[], expected })` → new commit SHA
6. Single-file writes use the Contents API with the file's blob SHA. Creating with `expectedSha = null` fails if the file exists. A stale SHA or an existing file raises `ConflictError`.
7. A multi-file change is one commit:
   - create the blobs (content-addressed, reused across retries);
   - read the head and check every expected SHA there;
   - create a tree on `base_tree` (deletions as `sha: null`);
   - commit, then update the ref with `force: false`.
     A non-fast-forward ref update is retried at the new head up to 3 times. An expected-SHA mismatch raises `ConflictError` and writes nothing.
8. JSON is validated with Zod on read and before write, and serialized deterministically (sorted keys, 2-space indent, trailing newline).
9. A GitHub App installation token is created per request, limited to `GITHUB_REPO_NAME` with `contents: write`, and never sent to the browser.
10. Route handlers map `ConflictError` to `409 { error: "conflict" }`, validation errors to `400`, and missing data to `404`. On `409` the client reloads the affected data and shows a localized conflict message; it never retries the write automatically.
11. An in-memory backend with the same semantics and real git blob SHAs is used by tests and fake mode.

### Projects

12. `mod.json`: `{ modId, name, phase: "planning", dependencies: [] }`.
    - The ID matches `^[a-z][a-z0-9_]{1,63}$` and is suggested from the name.
    - It must be unique among custom mods and library mods.
13. `pack.json`: `{ id, name, libraryModIds: [], customModIds: [] }`.
    - The ID is a kebab-case slug of the name (`^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 64 characters), suggested and editable.
    - It must be unique among modpacks.
14. Rename changes `name` only; IDs are immutable (ADR 0015).
15. Deleting a custom mod removes `data/custom-mods/<modid>/**`, `assets/icons/<modid>/**` and its ID from every `pack.json`, in one atomic commit.
    - The confirmation dialog lists the affected packs.
    - Deleting a modpack removes `data/modpacks/<pack-id>/**` in one commit.
16. Routes:
    - `/` redirects to `/designer`.
    - `/designer` and `/modpacks` redirect to the first project, sorted by name, or show an empty state with a create button.
    - `/designer/[modId]` and `/modpacks/[packId]` show the selected project.
    - Unknown IDs show not found.

### Texture route

17. `GET /api/textures/<namespace>/...png` serves `assets/textures/**`, and `GET /api/icons/<modid>/...png` serves `assets/icons/**`.
    - Each path segment must match `^[a-z0-9_.-]+$`; `.` and `..` segments are rejected.
    - Responses: `image/png` with `ETag` = blob SHA, and `304` on `If-None-Match`.
    - Caching: textures `Cache-Control: private, max-age=3600, stale-while-revalidate=86400`; icons `private, no-cache`.
    - Anything else gets `404`.

### i18n (ADR 0012)

18. Every UI string comes from `src/i18n/messages/{en,de}.ts`. User-entered names are never translated. Minecraft names stay English.
19. The language switch sets the `mf-locale` cookie (1 year). Without the cookie, `Accept-Language` decides (German if preferred, otherwise English). `<html lang>` matches.

### Theming (ADR 0011)

20. Themes `moss` "Overworld moss", `lantern` "Lantern", `deepslate-emerald` "Deepslate emerald"; modes `light`, `dark`, `system`. The default is `moss` + `system`.
21. Colors exist only as CSS custom properties, switched by `data-theme` and `data-mode` on `<html>` and mapped into Tailwind.
    - Tailwind's default palette is removed.
    - Tokens: `bg, surface, border, text, muted, accent, on-accent, secondary, ok, slot, danger, warning`.
22. Tints are the role color at 13 % over the surface (`bg-<role>/13`).
    - Status mapping, used from phase 4 on: backlog = muted, planned = secondary, implemented = ok.
    - Slots use `slot`; a selected slot has an `accent` outline.
23. Choices are stored in the `mf-theme` and `mf-mode` cookies (1 year). The server renders them on `<html>`, so the first paint is correct; `system` follows `prefers-color-scheme` in CSS.
24. Every text/background pair used meets WCAG AA (4.5:1 text, 3:1 UI components and large text) in all six variants, enforced by a unit test. Failing tokens are changed only in lightness, minimally, and listed in ADR 0011.

### Shell and layout

25. The top bar holds:
    - the view switcher;
    - the project selector for the active view, with create, rename and delete buttons;
    - a settings button (language, theme, mode);
    - sign out.
      On ≤ 640 px it wraps into two rows; controls stay ≥ 44 px tall, and dialogs become full-width sheets.

## Acceptance criteria

- [x] Signed out: `/designer` redirects to `/sign-in`, `/api/custom-mods` returns 401, and `/api/textures/...` returns 401.
- [x] A non-allowlisted GitHub account cannot sign in (unit-tested via the `signIn` callback logic).
- [x] Create, rename and delete of custom mods and modpacks work and persist; deleting a custom mod also removes its references in packs.
- [x] A stale write returns 409, and the UI reloads and shows the conflict message (unit-tested on both backends; tried in fake mode).
- [x] All six variants and three modes switch instantly and survive a reload without a flash of the wrong theme.
- [x] EN/DE switch survives a reload; no hard-coded UI strings.
- [x] Contrast test passes for all pairs in all variants.
- [x] Usable at 380 px width: no horizontal scroll, all controls reachable.
- [x] `npm run check` and `npm run build` pass.

## Open questions

- None open. Decisions made during planning are in ADRs 0011–0015.
