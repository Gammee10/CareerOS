# ADR 0003 — TypeScript end-to-end on Next.js

**Status:** Accepted — 2026-10-22
**Related:** Step 4 (stack), ADR 0002 (serverless)

## Context

The architecture is already serverless on Vercel (ADR 0002), with Supabase for database and auth.
The language choice was open: the owner is comfortable in both TypeScript and Python.

## Decision

One language, TypeScript, with Next.js 15 (App Router) as the framework. Strict mode, Zod at every
boundary, Drizzle for SQL, Vitest for tests, pnpm and Node 22 LTS.

## Consequences

- One runtime, one dependency tree, one deploy — and no cross-language IPC to design.
- Supabase's `@supabase/ssr` helper handles the session in the same process as the UI.
- `imapflow`, `mailparser` and `nodemailer` cover the mail work without leaving the ecosystem.
- Parsing and date logic are ordinary typed functions, which makes them testable and readable by an
  agent without special tooling.
- Python's advantage — data exploration — is not needed by this product.

## Rejected

- **Python backend + TypeScript UI**: two deploys and two toolchains for a one-deployable system.
- **Python only with server templates**: every interaction becomes a round trip, and Vercel's Python
  support is weaker than its Next.js support.
