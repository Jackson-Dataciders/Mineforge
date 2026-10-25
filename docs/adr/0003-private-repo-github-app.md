# 0003. Private repository, accessed through a GitHub App

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The repo contains third-party mod jars, textures extracted from them and vanilla Minecraft textures. Their licenses do not allow redistribution. The server needs write access to the repo without tying it to a personal token.

## Decision

- The repository is and stays **private**.
- Server-side repo access uses a GitHub App installed **only on this repository**. The server creates installation tokens from the app ID and private key (env vars in `.env.example`).
- Tokens are requested with the narrowest permissions the operation needs. Repo contents is the only permission the app needs.

## Consequences

- Nothing under `jars/`, `assets/` or `data/` may ever be published: no public repo, no public bucket, no `public/` folder (ADR 0004).
- The app's private key is the most sensitive secret. It lives only in Vercel env vars and local `.env.local`, never in the repo.
- Installation tokens expire after at most one hour; code must not cache them longer.

## Alternatives considered

- **Public repo with the app behind login:** the repo itself, and thus all jars and textures, would still be public.
- **Per-device personal access tokens:** broad, long-lived tokens on every device, tied to the user account, rotated by hand.
