# 07. Phone pass, README and final review

- **Status:** implemented
- **Date:** 2026-10-26
- **Related ADRs:** [0011](../adr/0011-theming-semantic-tokens.md), [0003](../adr/0003-private-repo-github-app.md), [0004](../adr/0004-authjs-github-allowlist.md)

## Goal

The app is usable on a phone, a new setup can be done from the README alone, and the build is checked against the original brief.

## Scope

- A phone usability pass on every view.
- The README: Vercel, the GitHub OAuth app for login, the GitHub App for repository access and its installation, env vars, adding jars and running the import skill.
- A final review against the brief, recorded in `docs/final-review.md`.

## Out of scope

- New features.
- Testing on physical devices; the pass uses a 375 px emulated viewport, see the unverified assumptions.

## Requirements

1. **Phone width.** At 375 px every page and dialog:
   - has no horizontal page scroll;
   - has interactive targets of at least 44×44 px. Exceptions: inline text links inside a sentence, and native checkboxes inside a label row of at least 44 px;
   - shows dialogs within the screen, scrolling inside;
   - uses input font size ≥ 16 px (no iOS focus zoom);
   - has no hover-only controls.
2. **Viewport:** `width=device-width, initial-scale=1`, no zoom lock, no `viewport-fit=cover` (so iOS keeps content inside the safe area).
3. **README** covers prerequisites, local development and fake mode, the OAuth app, the GitHub App (permission, installation, private key, installation ID), Vercel, first run (vanilla jar, jar upload, `import-mods` skill), rules and troubleshooting. Every variable in `.env.example` is explained.
4. **`docs/final-review.md`** maps every requirement of the brief to done / partially done / not done. It also lists the hard rules, the unverified version-specific assumptions and the known limitations.

## Acceptance criteria

- [x] **Audit:** a scripted audit (scroll width, target sizes, input font sizes, off-screen elements) passes at 375 px.
  - **Pages:** designer mod page, taskboard, mind map with filters open, entry forms of all six types, the pixel editor, recipe editor and item search dialogs, modpack page with the Edit mods dialog, recipe change editor, library with the upload dialog, the header's create/rename/delete/settings dialogs, and not-found.
  - **Languages:** English, plus German on the densest pages.
  - **One documented exception:** xyflow's small "React Flow" attribution link on the mind map.
- [x] **Fixes from the final review** (states the scripted audit couldn't reach with the fixture data):
  - chip remove buttons 44 px;
  - the task entry link 44 px;
  - the JSON recipe textarea at 16 px;
  - the recipe type select limited to the screen width;
  - long names and IDs wrap (`overflow-wrap: anywhere`);
  - mind map node dragging off by default on touch screens.
- [x] README checked against `.env.example` and `src/server/env.ts`.
- [x] `docs/final-review.md` written.

## Open questions

- None.
