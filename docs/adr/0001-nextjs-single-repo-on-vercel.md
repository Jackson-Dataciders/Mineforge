# 0001. Next.js App Router, TypeScript, React and Tailwind on Vercel in one repo

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Mineforge is a private planner for one user on three devices, one of them a phone. It needs a responsive UI and a small amount of server code (auth, GitHub access). There is no team and no separate backend workload.

## Decision

- The whole app is one Next.js project using the App Router and TypeScript (strict), with React for UI and Tailwind for styling.
- It is deployed on Vercel.
- UI, server code (route handlers, server components), tools and data live in this one repository.

## Consequences

- One toolchain, one deploy, one place for docs and ADRs; server and client share types and Zod schemas directly.
- Server code runs as Vercel functions, so their limits apply (request body ~4.5 MB, execution time); see ADR 0005.
- Next.js 16 conventions apply (`proxy.ts` instead of `middleware.ts`, `cacheComponents`). Read `node_modules/next/dist/docs/` before using Next.js APIs.

## Alternatives considered

- **Separate frontend and backend repositories:** more setup, deployment and versioning overhead with no benefit for a single user.
