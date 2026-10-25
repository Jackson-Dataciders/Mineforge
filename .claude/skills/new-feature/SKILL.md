---
name: new-feature
description: Build a new feature or project phase end to end following the CLAUDE.md workflow, from spec through plan, implementation with tests, docs and ADR updates, to checks and commit. Use when asked to build, add or implement a feature or phase.
argument-hint: "[feature or phase description]"
---

# New feature

Walks the workflow from `CLAUDE.md` for: $ARGUMENTS

Do the steps in order and don't skip any. Stop where a step needs the user's approval.

## 1. Orient

- Run `git pull --rebase`, because the app commits data to `main` at runtime.
- Read `docs/architecture.md`, `docs/glossary.md` and `docs/adr/README.md`, plus the ADRs and existing specs the feature touches.
- Check what exists. Anything marked "planned" in the architecture doc must be built first or be part of this feature; never import it as if it existed.
- Before using a Next.js API, read the matching guide in `node_modules/next/dist/docs/`.

## 2. Spec

- If `docs/specs/` already has an approved spec for this feature, use it. Otherwise create `docs/specs/NN-<slug>.md` from `docs/specs/00-template.md`, with NN = the highest existing number + 1.
- Fill in every section. Requirements are numbered and testable; acceptance criteria include phone-width behavior for UI, and both languages for UI strings.
- List open questions instead of guessing. Add the spec to the index in `docs/specs/README.md` with status `draft`.
- **Ask the user to approve the spec.** On approval, set the status to `approved`.

## 3. Plan

- Name the files to create or change, per layer (`src/domain`, `src/storage`, `src/server`, `src/app`, `src/components`, `src/i18n`, `tools`), and the tests for each.
- Flag decisions that are hard to reverse or affect other features: each becomes an ADR in step 5.
- Present the plan and wait for confirmation.

## 4. Implement with tests

- Write domain logic test-first (Vitest, colocated `*.test.ts`). Test storage code against its in-memory backend, not GitHub.
- Keep the hard rules in `CLAUDE.md`:
  - auth on every route
  - data access only through `src/storage/`
  - no textures in `public/`
  - UI strings only via `src/i18n/`, in both en and de
  - Minecraft names in English
  - entry fields only via the Zod schemas
  - no edits to `data/custom-mods/` or `data/modpacks/`
- Use the glossary terms in identifiers and UI.

## 5. Docs and ADRs

- If structure, layers, data files or flows changed, update `docs/architecture.md`, and remove the "planned" markers for what now exists.
- For each flagged decision, run the `new-adr` skill.
- If implementation diverged from the spec, update the spec; then set its status to `implemented`, also in the index.
- If a new rule must hold for all future work, add one line to `CLAUDE.md`. Keep CLAUDE.md under ~120 lines and put the details in docs.

## 6. Checks

- Run `npm run lint`, `npm run typecheck` and `npm run test`; run `npm run build` too if routes, config or dependencies changed. Fix failures; never disable a rule or skip a test to pass.
- Run the `reviewer` agent on the change and fix every violation it reports.

## 7. Commit

- Stage only the files of this feature: `git add <paths>`, never `data/custom-mods/` or `data/modpacks/`.
- Commit with a Conventional Commit message (`feat: ...`, `fix: ...`, `docs: ...`).
- Report what was built, which spec and ADRs changed, and anything left open. Push only if the user asks.
