# Stage 5 · Step 3 — Build, buy, or borrow

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-22

## Principle

Build only what makes this product _this_ product. Everything else is bought, borrowed, or run by
someone else. The core is:

1. **Ingestion** — turning a forwarded email into a normalised message.
2. **Parsing** — company, role, stage from real sender formats.
3. **Due logic** — what is owed next, including the silence rule.
4. **Digest composition** — what gets said on Monday morning.

If a piece is not on that list, we do not write it.

## Where each piece goes

| Piece          | Build / buy / borrow | Choice                                          | Why                                                                                  |
| -------------- | -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Database       | Borrow               | **Supabase Postgres (free)**                    | Already proven in Spike 5; backups and pooling included                              |
| Inbound email  | Borrow               | **Gmail + IMAP** (ADR 0001)                     | No domain available; validated in Spike 2                                            |
| Queue          | Build on Postgres    | **One table** (Spike 5)                         | No broker needed; 6/6 tests passed                                                   |
| Parser         | **Build**            | Own rules                                       | This _is_ the product; a black-box model cannot be tested or trusted                 |
| Due logic      | **Build**            | Own code                                        | The wedge; nobody sells it                                                           |
| Auth           | Buy                  | **Supabase Auth**                               | Same project, magic link, `auth.uid()` for `owner_id`                                |
| Outbound email | Borrow               | **Gmail SMTP**                                  | No domain; same credential as ingestion                                              |
| Hosting        | Borrow               | **Vercel Hobby + free external scheduler ($0)** | Serverless; ingest triggered every 5 min ([ADR 0002](adr/0002-serverless-ingest.md)) |
| Scheduler      | Build                | Cron + DB idempotency key                       | Spike 4: the key is the safety net, not the timer                                    |
| UI shell       | Build thinly         | Framework + component library                   | Screens are simple; do not hand-roll a design system                                 |
| Error tracking | Buy (later)          | Nothing in v1                                   | Logs first; add Sentry when there is a real user                                     |

## Decision 1 — Hosting

**What the decision is:** where the web app and the always-on email poller run.

| Option                  | Strength                                           | Weakness                                                                      |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Railway ~$5/mo**      | One always-on service, cron, git deploy, no Docker | Costs money — $5 is the whole budget                                          |
| Fly.io ~$3/mo           | Cheaper at low usage, more control                 | Docker and machine ops; more moving parts for one person                      |
| Render free             | Free web tier                                      | **Sleeps after 15 min** — kills a 60-second poller                            |
| GitHub Actions cron     | Free on public repos                               | 5-minute minimum; 5–10 min latency; disabled after 60 days of repo inactivity |
| Cloudflare Workers cron | Free, 1-minute cron, never sleeps                  | Runtime cannot do IMAP; would force an HTTP mail API and invalidate ADR 0001  |

**Recommendation: Railway.** The ingestion design needs a process that is awake. Rooting around
free tiers to save $5 buys latency, fragility, and a silent-death failure mode — the exact thing a
reminder product cannot afford. If $0 becomes a hard requirement, GitHub Actions at 5-minute
granularity is the fallback, with the ingest NFR relaxed from 2 minutes to 10.

## Decision 2 — Authentication

| Option                | Strength                                                                                               | Weakness                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Supabase Auth**     | Free, same project as the database, `auth.uid()` maps to `owner_id`, magic link needs no password code | Tied to Supabase; free tier limits auth emails to a few per hour                           |
| Clerk                 | Best developer experience, polished UI                                                                 | Third vendor, another redirect flow, another bill later                                    |
| Auth.js (self-hosted) | No vendor, full control                                                                                | We write sessions, cookies, expiry, and the reset flow — days of work for no product value |

**Recommendation: Supabase Auth.** It is already in the stack, and it makes `owner_id` a one-line
rule rather than a permission model we invent.

## Decision 3 — Outbound email (the digest)

| Option                           | Strength                                             | Weakness                                                                                       |
| -------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Gmail SMTP** (project mailbox) | Free, no domain needed, same credential as ingestion | Gmail rate limits; poor fit if the product ever sends to strangers; same fragility as ADR 0001 |
| Resend                           | Excellent deliverability and DX, 100/day free        | **Requires a verified domain** — we have none, so it cannot send to the user at all            |
| Postmark                         | Best deliverability in class                         | 100/month free, also needs a domain                                                            |
| Amazon SES                       | Cheapest at scale                                    | Production access approval; needs a domain                                                     |

**Recommendation: Gmail SMTP for v1**, sending from the project mailbox to the one user. It is the
only option that works without a domain today. When a domain exists, move to Resend — the send call
is one function behind an interface, so it is an adapter swap, not a rebuild.

**Note the coupling:** one app password now powers both ingestion and digest delivery. If it breaks,
both break. Recorded here so it is not a surprise.

## What this costs

| Item                              | Monthly                                   |
| --------------------------------- | ----------------------------------------- |
| Vercel Hobby                      | $0.00                                     |
| External scheduler (cron-job.org) | $0.00                                     |
| Supabase                          | $0.00                                     |
| Gmail (in and out)                | $0.00                                     |
| **Total**                         | **$0.00** — below even the `< $10` target |

## What we are deliberately not buying

No managed queue, no workflow engine, no vector database, no LLM API, no analytics platform, no
error-tracking SaaS in v1. Each would be a real dependency for a product with one user.

## Hosting — DECIDED 2026-10-22

Paid hosting (Railway, $5/mo) was rejected: the project stays at **$0**.

**Adopted:** Vercel Hobby hosts the web app and `POST /api/ingest`; a free external scheduler calls
it every 5 minutes. There is no always-on process anywhere in the system.

This supersedes the "always-on worker is required" assumption above and amends ADR 0001 —
see [ADR 0002](adr/0002-serverless-ingest.md). Ingest latency moves from `< 2 min` to `< 6 min`.
