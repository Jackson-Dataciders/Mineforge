# Final review

Review of the build against the setup brief and the phased build brief (phases 1–7), done in phase 7 (2026-10-26). Two read-only reviews checked every requirement in the code, and the findings were fixed in the phase 7 commit unless listed under open items. User decisions that refine the brief are recorded in specs and ADRs and count as done.

## Requirement checklist

| Area                                                                                                                                     | Status | Notes                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setup (phase 0):** repo, tooling, CLAUDE.md, architecture, ADR/spec templates, glossary, settings, hooks, skills, reviewer agent       | done   | Stale "(planned)" markers in ADRs removed in phase 7.                                                                                                                                              |
| **Stack, i18n (en/de), English Minecraft names, theming with AA-tested tokens**                                                          | done   | Placeholder text now uses the tested `muted` token; the toast shadow (default black) was removed.                                                                                                  |
| **Auth:** GitHub login, allowlist, proxy plus `requireUser`/`apiRoute` everywhere                                                        | done   | Exceptions: `/sign-in` and the Auth.js handler, named in CLAUDE.md rule 2. An expired session now leads to sign-in.                                                                                |
| **Storage:** GitHub App, SHA-safe writes, atomic commits, conflict → reload                                                              | done   | —                                                                                                                                                                                                  |
| **Vercel build skip** for data-only commits                                                                                              | done   | Fixed in phase 7: diffs from `VERCEL_GIT_PREVIOUS_SHA` instead of `HEAD^`.                                                                                                                         |
| **Authenticated texture/icon routes**, nothing in `public/`                                                                              | done   | —                                                                                                                                                                                                  |
| **Phase 1:** foundation, shell, project CRUD, settings                                                                                   | done   | Reserved mod IDs (`minecraft`, `neoforge`, …) are now refused (ADR 0015).                                                                                                                          |
| **Phase 2:** `tools/extract-jar.ts` with tests, matching the `import-mods` skill                                                         | done   | —                                                                                                                                                                                                  |
| **Phase 3:** library, jar upload, packs, dependency warnings, item search, recipe changes with visual editors, KubeJS export, pack tasks | done   | Upload: the browser creates blobs and the server makes the commit (ADR 0005, spec 03). "Remove recipe" was added by user decision (ADR 0020).                                                      |
| **Phase 4:** entries of six types with dependent fields, recipes, custom recipe types, pixel editor                                      | done   | Phase 7 fixes: custom recipe outputs keep the right ID when a new entry is renamed; fast pencil strokes no longer leave gaps.                                                                      |
| **Phase 5:** phases, generated and manual tasks, taskboard (drag and drop plus move buttons), filter                                     | done   | Done tasks are kept (ADR 0022, user decision).                                                                                                                                                     |
| **Phase 5:** status icon wherever entries appear                                                                                         | done   | Extended in phase 7 to item lists, slots and delete dialogs. Native selects can't show icons.                                                                                                      |
| **Phase 6:** mind map, recipe and relation edges, labeled styles, ELK layout, saved positions, re-layout, filters                        | done   | Phase 7 changes: new nodes get an ELK layout beside the stored one, each relation type has its own line style, a tap opens the entry. Outside items sit behind a filter (ADR 0023, user decision). |
| **Phase 7:** phone pass on every view                                                                                                    | done   | 375 px audit in en/de plus review fixes (spec 07). Not tested on a physical phone.                                                                                                                 |
| **Phase 7:** README (Vercel, OAuth app, GitHub App, env vars, jars, skill)                                                               | done   | —                                                                                                                                                                                                  |
| **Phase 7:** final review                                                                                                                | done   | This file.                                                                                                                                                                                         |
| **Output:** per-phase commits, specs/ADRs/architecture kept current                                                                      | done   | —                                                                                                                                                                                                  |

## Hard rules

| Rule                                                     | Status                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| 1 Private repo                                           | Not checkable from code; stated in README and CLAUDE.md |
| 2 Allowlisted login on every page and route              | done (two named public exceptions)                      |
| 3 No textures in `public/`                               | done                                                    |
| 4 Data access through `src/storage/`                     | done (jar blob upload exception, ADR 0005)              |
| 5–7 English code, English Minecraft names, i18n en+de    | done (parity test)                                      |
| 8 No hand edits to `data/custom-mods/`, `data/modpacks/` | done                                                    |
| 9 Type-specific fields only in Zod schemas               | done                                                    |
| 10 Pull before work, no force-push                       | done                                                    |
| 11 No secrets                                            | done                                                    |
| 12 Glossary terms                                        | done                                                    |
| 13 Colors only via theme tokens                          | done                                                    |

## Known limitations and open items

- **Texture route cost:** every texture or icon request creates a new installation token and reads GitHub (React `cache()` doesn't apply in route handlers). Opening the item search costs about 100 GitHub calls. Caching the token until expiry needs an ADR.
- **Expected-SHA checks** make one GitHub call per path, so deleting a large custom mod fires many parallel calls.
- **"Pending import" differs** between the app (the jar file has no `meta.json`) and the `import-mods` skill (the mod ID has no data). A newer jar of an imported mod stays "pending" until it is imported with `--force`.
- **Mind map:**
  - raw JSON recipes give no "ingredient of" edges;
  - several relations between the same two nodes overlap;
  - a position saved right before leaving the page can arrive after the next page loads.
- **Pixel editor:** with fill or eyedropper selected, the first finger of a pinch applies the tool.
- **Extractor:** MANIFEST continuation lines aren't joined (long versions get truncated); re-imports keep textures the new jar dropped.
- **Upload token:** it can write the whole repository for up to 1 h (ADR 0005).
- **Settings rule:** `.claude/settings.json` uses `Read(!.env.example)`. Whether permission rules support that negation is unverified, but reading `.env.example` worked.

## Version-specific assumptions not verified against documentation

**Auth.js (`next-auth@5.0.0-beta.32`)**

- `auth()` used as the Next 16 `proxy`;
- `providerAccountId` is the numeric GitHub ID;
- the `AccessDenied` redirect when sign-in is refused;
- no `AUTH_URL` needed on Vercel.

**Next.js 16.4**

- `proxy.ts` details;
- the global `PageProps`/`LayoutProps` types;
- the `@tailwindcss/turbopack` loader setup.

**GitHub REST**

- Contents API behavior for files from 1–100 MB;
- the error codes for a stale SHA and for creating an existing file;
- `updateRef` non-fast-forward errors;
- `createTree` with `sha: null`;
- CORS for browser `git/blobs` calls with an installation token;
- the blob size limit for about 134 MB of base64;
- read-after-write consistency;
- where the installation ID is shown after installing a GitHub App;
- `@octokit/auth-app` token scoping (`repositoryNames`, `permissions`).

**KubeJS 2101**

- the `event.shaped`, `shapeless`, cooking `.xp().cookingTime()`, `stonecutting`, `smithing` (argument order) and `custom` APIs;
- `"Nx id"` results;
- `.id()` with a hyphenated pack namespace;
- one `ServerEvents.recipes` per file;
- `neoforge:conditions` inside `event.custom`.

**Minecraft 1.21.1 / NeoForge**

- recipe JSON shapes (`result: {id, count}`, pre-1.21.2 ingredients);
- the model and recipe folder layout;
- `neoforge.mods.toml` dependency `type` values and `${file.jarVersion}`;
- the planning-field ranges (stack size, rarities, tool tiers, boss bar colors and overlays, structure spacing).

**@xyflow/react 12.12**

- `ariaLabelConfig` keys;
- preset `measured`/`handles` skipping DOM measuring;
- the third `onNodeDragStop` argument;
- the `--xy-*` CSS variables;
- touch pan and pinch behavior.

**elkjs 0.12**

- the import path `elk.bundled.js`;
- the layered option keys;
- the top-left coordinate origin.

**Browser**

- exact canvas and PNG alpha round trips;
- the keepalive body limit (about 64 KB);
- HTML5 drag and drop on touch devices;
- `dvh` units on iOS.

**Claude Code config**

- the hook `command` + `args` form;
- subagent `hooks:`/`disallowedTools:` frontmatter.

**Vercel**

- the `ignoreCommand` shell and clone depth for `VERCEL_GIT_PREVIOUS_SHA`.

**Not tested for real:** GitHub App commits and uploads, OAuth on Vercel, KubeJS scripts in a game, extraction against many mods, and touch input on a physical phone.
