# 0002. The private GitHub repository is the database

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Data must sync across three devices for one user. The data is small, document-shaped (one JSON file per entry, pack or mod) plus PNG icons and textures, and benefits from history. Running a database server for one user costs money and operations.

## Decision

- All app data is stored as JSON files and PNGs in this repository under `data/` and `assets/` (layout in `docs/architecture.md`). Jars live under `jars/`.
- At runtime, server code reads and writes these files through the GitHub REST API. Only the storage layer (`src/storage/`) does this.
- Every write sends the file SHA the client last read. If the SHA no longer matches, the write fails with a conflict. The UI then reloads the current version instead of overwriting it.
- A change that touches several files is one atomic commit via the Git Data API (blobs → tree → commit → update ref). The ref update is not forced, so a concurrent commit causes a conflict, not a lost update.
- Commits that touch only `data/`, `assets/` or `jars/` skip the Vercel build, via `ignoreCommand` in `vercel.json`. It diffs from the last successful deployment (`VERCEL_GIT_PREVIOUS_SHA`), so a code commit followed by a data commit is still deployed; without that SHA it builds.

## Consequences

- No database to host; full history and diffs of all planning data come for free.
- Every write is a commit on `main`. Local Claude Code sessions must pull before working and must never rewrite history.
- Latency per write is that of several GitHub API calls. API rate limits apply; reads should be cached per request.
- Large files: the Contents API returns content inline only up to 1 MB. Larger files need the raw media type or the Git blobs API. GitHub rejects files over 100 MB.
- Vercel clones the repo, jars included, on every build. Build time grows with the jar collection.

## Alternatives considered

- **IndexedDB in the browser:** data would stay on one device and not sync.
- **SQLite on a VPS:** hosting costs and operations (backups, updates, security) for a single user.
