# Stage 5 · Step 4 — Choose the stack

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-22
**Criteria (from the guide, minus "what you already know" — both languages are fine):** fit for the
problem, hosting fit, cost, community and docs, and how friendly it is to an agent.

## The decision

**One language or two, and which one.**

Everything downstream inherits this: the parser, the due logic, the digest, the tests, and how many
things can break at deploy time.

## Options

| Option                                                                              | Strength                                                                                                                                                                                                                 | Weakness                                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. TypeScript end-to-end** — Next.js on Vercel, Node libraries for IMAP/MIME/SMTP | Vercel-native: one repo, one deploy, one toolchain. Mature, boring libraries for every piece we need. Strong types and Zod make the parser and due logic testable and agent-readable. Huge ecosystem for Next + Supabase | Weaker than Python for ad-hoc data work (no pandas); regex-heavy parsing is fine but less pleasant                                                         |
| B. Python backend (FastAPI) + TypeScript UI                                         | Best of both languages; Python is nicer for parsing experiments                                                                                                                                                          | Two runtimes, two deploys, two dependency trees, two test setups. Vercel's Python support is second-class, and the IMAP subscription lives far from the UI |
| C. Python only (FastAPI + Jinja/HTMX)                                               | Simplest machine: no JS build, no client state                                                                                                                                                                           | The UI work (inline edits, snooze, review queue) becomes server round-trips; less familiar tooling for a portfolio piece; Vercel fit is poor               |

**Recommendation: A.**

The deciding factor is not language preference — it is that **the architecture is already
serverless on Vercel**, and one runtime removes an entire class of integration work. The second
factor is the previous step's decisions: Supabase ships a first-class Next.js auth helper, and every
piece we need (IMAP client, MIME parser, SMTP sender, cron handling) has a mature Node package.

Python's advantage is data exploration, and we are not doing data exploration in the product.

## The stack

| Layer           | Choice                                         | Why                                                                                          |
| --------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Framework       | **Next.js 15 (App Router), TypeScript strict** | Vercel-native; API routes and UI in one deployable                                           |
| Styling / UI    | **Tailwind CSS + shadcn/ui**                   | Components are copied in, not depended on — borrow, don't build                              |
| Database access | **Drizzle ORM + `postgres.js`**                | Typed schema, SQL-close, raw escape hatch for `SKIP LOCKED`; lighter cold starts than Prisma |
| Validation      | **Zod**                                        | One schema for forms, API input, and parsed email output                                     |
| Auth            | **Supabase Auth via `@supabase/ssr`**          | Already decided in Step 3; `auth.uid()` becomes `owner_id`                                   |
| Inbound email   | **`imapflow` + `mailparser`**                  | Mature, handles TLS, search and MIME correctly                                               |
| Outbound email  | **`nodemailer`**                               | Gmail SMTP with an app password                                                              |
| Date/time       | **Luxon**                                      | IANA-zone arithmetic that Spike 4 proved we need; no hand-rolled DST logic                   |
| Tests           | **Vitest**                                     | Fast, TypeScript-native, no config fight                                                     |
| Package manager | **pnpm**, Node 22 LTS                          | Fast, strict, standard                                                                       |

## Repo shape

**One app, modules inside it — not a monorepo.**

```
career-os/
  src/
    app/            routes and pages
    modules/
      ingest/       IMAP fetch -> inbound row
      parse/        rules: company, role, stage
      applications/ reads, edits, status
      due/          what is owed next, including silence rule
      digest/       Monday composition and send
    db/             schema, migrations, queries
    lib/            shared clients (supabase, mail, time)
  docs/             this planning record
```

A monorepo would add workspace tooling for a project with one deployable. The module boundaries do
the same job for free, and they are the seams from [principles.md](../principles.md).

## What this explicitly is not

No tRPC, no GraphQL, no state management library, no component library beyond shadcn, no ORM beyond
Drizzle, no monorepo tooling, no Docker. Each would be a dependency earning nothing on a product with
one user.

## Cost impact

None. Every library above is open source; hosting stays at $0.
