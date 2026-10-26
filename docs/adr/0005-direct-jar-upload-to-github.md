# 0005. Jars are uploaded from the browser directly to GitHub

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Vercel limits function request bodies to about 4.5 MB. Mod jars are often larger, up to tens of MB.

## Decision

- An authenticated route issues a short-lived GitHub App installation token, limited to this repository with `contents: write` only.
- The browser uses this token to create the jar's blob directly on GitHub (Git Data API).
- The browser then sends only the blob SHA and the file name to an API route. That route commits the file under `jars/mods/` through the storage layer.
- Maximum jar size is **100 MB** (GitHub's hard file limit). The UI rejects larger files before uploading.

## Consequences

- No large bodies pass through Vercel; no extra storage service.
- The token is visible in the browser for up to one hour (installation tokens cannot be shorter). It can write repo contents, so it is issued only to the allowlisted user and only on demand. Contents write covers the whole repository, code included: a leaked token could push code that Vercel then deploys, until it expires.
- Blob upload is base64 JSON, so a 100 MB jar is about 134 MB on the wire; the UI must show progress.

## Alternatives considered

- **Upload through an API route:** fails above the ~4.5 MB body limit.
- **Vercel Blob as intermediate storage:** an extra service and a second copy step for no gain.
