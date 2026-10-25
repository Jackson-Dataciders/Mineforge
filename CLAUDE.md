# Mineforge

Private, single-user web app for planning Minecraft 1.21.1 NeoForge mods and modpacks, used on three devices including a phone.

- **Mod Designer:** custom mods are planned as typed entries (item, block, entity, structure, mechanic, multiblock) with visual recipe editors, 16×16 pixel-art icons, statuses, a mind map of relations, and a taskboard of tasks generated per phase.
- **Modpack Planner:** modpacks combine library mods (imported from jars) and custom mods, design recipe changes visually and export them as KubeJS scripts.
- The private GitHub repo is the database. Next.js on Vercel reads and writes it through the GitHub API.
- UI in English and German.

**Current state:** phases 1 (foundation), 2 (jar extraction, `tools/extract-jar.ts`) and 3 (Modpack Planner: library, upload, recipe changes, KubeJS export, pack tasks) are done. Anything marked "planned" in `docs/architecture.md` does not exist yet.

## Commands

```
npm run dev           # dev server (Turbopack)
npm run build         # production build
npm run lint          # ESLint, incl. layer import rules
npm run format        # Prettier write (format:check to verify)
npm run typecheck     # next typegen && tsc --noEmit
npm run test          # Vitest, run once
npm run check         # lint + typecheck + test
npx tsx tools/<script>.ts
```

Local UI checks without GitHub credentials: the `dev-fake` config in `.claude/launch.json` sets `MINEFORGE_DEV_FAKE=1` (in-memory data with a small library/vanilla fixture, fake login, `next dev` only; ADR 0014). `MINEFORGE_DEV_SEED_DIR=<folder>` seeds it from real extracted data instead.

A PostToolUse hook runs Prettier on every file Claude edits (`.claude/hooks/format.mjs`).

## Hard rules

1. **The repo stays private.** It holds third-party jars and textures that may not be redistributed (ADR 0003).
2. **Every page and route requires the allowlisted login.** This means `src/proxy.ts`, plus `requireUser()` in the `(app)` layout and every page, and `apiRoute()` around every route handler (ADR 0013). The app serves private, licensed data on a public URL (ADR 0004).
3. **No textures or icons in `public/`.** Next.js serves `public/` without auth; images go through the authenticated texture route (ADR 0004).
4. **All data access goes through `src/storage/`.** Never call GitHub from components or routes directly; SHA checks and atomic commits live in one place (ADR 0002). ESLint enforces this.
5. **Code is English:** identifiers, file names, comments, docs and commit messages. That keeps one vocabulary (see `docs/glossary.md`).
6. **Minecraft names are always English** (`minecraft:iron_ingot`, "Iron Ingot"), also in the German UI. They must match the game and the lang files.
7. **UI strings only through i18n** (`src/i18n/`, en + de), never hard-coded in components. Both languages must stay switchable.
8. **Never edit `data/custom-mods/` or `data/modpacks/` outside the app**, including in Claude Code sessions and scripts. They are the user's planning data and must stay schema-valid with correct SHAs.
9. **Type-specific entry fields exist only in the Zod schemas** (`src/domain/`). Forms, storage and tasks derive from them, so invalid combinations can't be saved (ADR 0009).
10. **`main` receives runtime commits from the app.** Run `git pull --rebase` before starting work. Never force-push or rewrite history.
11. **No secrets in the repo.** Env vars are listed in `.env.example`; real values live in `.env.local` and Vercel.
12. **Use the glossary terms exactly** (`docs/glossary.md`) in code and UI.
13. **Colors only via theme tokens** (`bg-surface`, `text-muted`, `bg-accent/13`, …; ADR 0011), never hex values or palette classes. Every new text/background pair goes into `src/theme/tokens.test.ts` first, because all six variants must meet WCAG AA.

## Workflow for every feature

Use the `new-feature` skill. It walks these steps:

1. **Spec:** write `docs/specs/NN-name.md` from `docs/specs/00-template.md` and get the user's approval.
2. **Plan:** list the files to touch and the tests to add; confirm with the user.
3. **Implement with tests:** domain logic test-first; storage via its in-memory backend; no feature without tests.
4. **Architecture:** if structure, layers, data files or flows changed, update `docs/architecture.md`, including the "planned" markers.
5. **ADR:** add one for every decision that is hard to reverse or affects other features (`new-adr` skill).
6. **Checks:** `npm run lint`, `npm run typecheck` and `npm run test` must pass, and `npm run build` when routes or config changed. Optionally run the `reviewer` agent.
7. **Commit:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`; `data:` for imports), one logical change per commit.

## Where to find what

| What                                           | Where                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| System, layers, data layout, flows             | `docs/architecture.md`                                                    |
| Decisions and their reasons                    | `docs/adr/README.md` (index), `docs/adr/NNNN-*.md`                        |
| Feature specs                                  | `docs/specs/README.md`, `docs/specs/NN-*.md`                              |
| Terms                                          | `docs/glossary.md`                                                        |
| Next.js 16 docs matching the installed version | `node_modules/next/dist/docs/` (see `AGENTS.md`)                          |
| Env vars                                       | `.env.example`                                                            |
| Claude Code permissions and hooks              | `.claude/settings.json`, `.claude/hooks/`                                 |
| Skills                                         | `.claude/skills/`: `import-mods`, `new-adr`, `new-feature`                |
| Subagents                                      | `.claude/agents/reviewer.md` (read-only review against rules, spec, ADRs) |
| Mod import                                     | `import-mods` skill + `tools/extract-jar.ts` (spec 02, ADR 0017)          |
