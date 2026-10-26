# Mineforge

A private, single-user web app for planning Minecraft 1.21.1 (NeoForge) mods and modpacks. It runs on Next.js on Vercel and uses this private GitHub repository as its database.

This repository is **private** and must stay private: it contains third-party jars and textures that may not be redistributed (ADR 0003).

- [CLAUDE.md](CLAUDE.md): commands, hard rules, workflow
- [docs/architecture.md](docs/architecture.md): system, layers, data layout, flows
- [docs/adr/](docs/adr/README.md): architecture decisions
- [docs/specs/](docs/specs/README.md): feature specs
- [docs/glossary.md](docs/glossary.md): terms
- [docs/final-review.md](docs/final-review.md): requirement checklist, unverified assumptions, known limitations

## How it fits together

- **Login:** a GitHub **OAuth app** signs you in through Auth.js. Only one GitHub user ID is allowed (ADR 0004).
- **Data access:** a GitHub **App**, installed only on this repository, lets the server read and commit data files and lets the browser upload jars straight to GitHub (ADR 0003, 0005).
- **Hosting:** Vercel deploys the app from this repository. Commits that only touch `data/`, `assets/` or `jars/` don't trigger a new build (`vercel.json`).

You need both GitHub apps: the OAuth app identifies you, the GitHub App writes to the repo.

## Prerequisites

- Node 24 (`.nvmrc`; `nvm use`)
- A GitHub account that owns (or can administer) this repository
- A Vercel account
- For importing mods: Claude Code (the `import-mods` skill), optionally Java for decompiling

## Local development

```bash
nvm use
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev
```

Commands (build, lint, tests, formatting) are listed in [CLAUDE.md](CLAUDE.md#commands).

**Without any credentials**, use fake mode for UI work: set `MINEFORGE_DEV_FAKE=1` in `.env.local` (or use the `dev-fake` launch config in `.claude/launch.json`). It runs only under `next dev`, logs you in automatically and keeps data in memory with a small fixture (ADR 0014). `MINEFORGE_DEV_SEED_DIR=<folder>` seeds it from real extracted data instead.

## Setup

All environment variables are listed, with comments, in [`.env.example`](.env.example). Set the same values in `.env.local` (local) and in Vercel (deployed). Never commit real values.

### 1. GitHub OAuth app (login)

1. GitHub → your profile picture → **Settings** → **Developer settings** → **OAuth apps** → **New OAuth App**.
2. **Application name:** e.g. "Mineforge". **Homepage URL:** your Vercel URL, e.g. `https://mineforge-<you>.vercel.app`.
3. **Authorization callback URL:** `https://<your-app>/api/auth/callback/github`. For local development, also add `http://localhost:3000/api/auth/callback/github` with **Add callback URL** (or use a second OAuth app for localhost).
4. **Register application**, then **Generate a new client secret**.
5. Set:
   - `AUTH_GITHUB_ID`: the client ID
   - `AUTH_GITHUB_SECRET`: the client secret
   - `AUTH_SECRET`: a random secret, e.g. from `npx auth secret`
   - `ALLOWED_GITHUB_USER_ID`: your **numeric** GitHub user ID (not the login name). Find it as `"id"` in `https://api.github.com/users/<your-login>`.

Only this user can sign in; anyone else is sent back to the sign-in page, and API calls answer 401.

### 2. GitHub App (repository access)

1. GitHub → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**.
2. **GitHub App name:** something unique, e.g. "mineforge-<you>". **Homepage URL:** your app or repo URL. Leave **Callback URL** empty.
3. **Webhook:** clear **Active** (the app needs no webhooks).
4. **Permissions → Repository permissions → Contents: Read & write.** Leave everything else at **No access** (Metadata read-only is added automatically).
5. **Where can this GitHub App be installed?** → **Only on this account**. Click **Create GitHub App**.
6. On the app's settings page:
   - copy the **App ID** → `GITHUB_APP_ID`;
   - under **Private keys**, **Generate a private key**. A `.pem` file downloads. Put its full content in `GITHUB_APP_PRIVATE_KEY`. In Vercel and `.env.local` you can paste it with real newlines or with literal `\n`; the app converts `\n` to newlines.
7. **Install App** → **Install** on your account → **Only select repositories** → choose this repository → **Install**.
8. After installing, the installation's configuration page has a URL ending in a number (`…/settings/installations/<number>`). That number is `GITHUB_APP_INSTALLATION_ID`.
9. Set the repository variables:
   - `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`: this repository
   - `GITHUB_DATA_BRANCH`: the branch the app commits to (default `main`)

The private key can write to this repository. Keep it only in Vercel and `.env.local`. If it leaks, delete it on the app's settings page and generate a new one.

### 3. Vercel

1. In Vercel, **Add New → Project** and import this private repository. The framework preset is Next.js; Node 24 comes from `package.json` (`engines`).
2. Add every variable from steps 1 and 2 under **Settings → Environment Variables** for **Production** (and **Preview**, if you use preview deployments and have added their URL as an OAuth callback). Don't set `MINEFORGE_DEV_FAKE` or `MINEFORGE_DEV_SEED_DIR`. `AUTH_URL` isn't needed on Vercel.
3. Deploy. Check that the OAuth app's callback URL matches the production domain exactly.
4. Vercel's own Deployment Protection is optional: the app itself requires the allowlisted login on every page and route.

`vercel.json` skips builds for commits that only change `data/`, `assets/` or `jars/`, so the app's own data commits don't redeploy it.

## First run

1. Open the app and sign in with GitHub.
2. **Vanilla data:** put the Minecraft 1.21.1 client jar into `jars/vanilla/` (in a local checkout) and run the import (step 4). Items and recipes of vanilla come from it.
3. **Add mod jars:** on **Library → Upload jars**, pick NeoForge jars for Minecraft 1.21.1. The browser uploads them straight to `jars/mods/` in this repo; they appear as pending until imported. You can also commit jars to `jars/mods/` yourself.
4. **Import:** in a local checkout, run `git pull --rebase`, start Claude Code and ask it to import mods (the [`import-mods`](.claude/skills/import-mods/SKILL.md) skill). It runs `npx tsx tools/extract-jar.ts <jar>` for each pending jar, adds clearly marked inferred data, reports missing dependencies, and commits `data: import …`. Push the commit; the app reads it right away.
5. Create a custom mod (Mod Designer) or a modpack (Modpack Planner) from the project selector.

## Rules worth knowing

- Never edit `data/custom-mods/` or `data/modpacks/` by hand; the app keeps them schema-valid with SHA checks.
- The app commits to `main` at runtime. Run `git pull --rebase` before working locally, and never force-push.
- No textures in `public/`: images are served only through authenticated routes.

## Troubleshooting

| Symptom                                             | Likely cause                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in returns to the sign-in page                 | `ALLOWED_GITHUB_USER_ID` isn't your numeric ID, or it's not set in this environment                                            |
| GitHub says the redirect URI is not associated      | The OAuth app's callback URL doesn't match `https://<domain>/api/auth/callback/github`                                         |
| "Missing or invalid GitHub env vars: …" in the logs | One of the `GITHUB_*` variables is missing; the message names it                                                               |
| Errors creating the installation token              | Wrong `GITHUB_APP_INSTALLATION_ID`, the app isn't installed on this repo, or the private key is truncated (check the newlines) |
| "This was changed elsewhere"                        | Someone (or another device) saved first; the page reloads with the latest data, then try again                                 |
| Jar upload fails                                    | The GitHub App lacks **Contents: Read & write**, or the jar is over 100 MB (the limit the app and GitHub share)                |
