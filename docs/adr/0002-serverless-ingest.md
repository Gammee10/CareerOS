# ADR 0002 — Serverless ingest, triggered by an external scheduler

**Status:** Accepted — 2026-10-22
**Amends:** ADR 0001 (the IMAP mechanism stays; the _trigger_ changes)
**Related:** Stage 4 spec (ingest NFR), Spike 4 (scheduler), Step 3 (build/buy/borrow)

## Context

ADR 0001 assumed an always-on process polling the mailbox every 60 seconds. Step 3 priced that at
~$5/month (Railway), and the project owner ruled out any paid hosting.

The always-on requirement was never a product requirement — it was an implementation choice. Nothing
in the product needs a process running continuously; it needs **emails to be picked up reasonably
soon**, and the digest to fire once a week.

## Decision

1. **No always-on worker.** The web app and the ingest logic run as serverless functions on
   **Vercel Hobby** ($0).
2. **An external scheduler triggers ingestion.** A free scheduler (cron-job.org, with GitHub Actions
   as a fallback) calls `POST /api/ingest` **every 5 minutes** with a shared secret.
3. Each call: open IMAP, fetch unseen mail, persist to `inbound`, parse, close. Bounded work, well
   inside a function's time limit.
4. **The digest is triggered hourly**, not at an exact minute. The idempotency key
   `(user_id, iso_week)` from Spike 4 makes double-firing impossible, and the 6-hour catch-up window
   means a late trigger still delivers.

## Consequences

| Change               | Detail                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ingest latency       | **< 2 min becomes < 6 min p95** (5-minute trigger + processing). Spec amended                                                                                                                          |
| Always-on process    | Removed entirely. Nothing to keep awake, nothing to pay for                                                                                                                                            |
| Digest precision     | Timer no longer has to be exact; idempotency does the work                                                                                                                                             |
| Database connections | Serverless needs the **Supabase pooler** connection string, not the direct one                                                                                                                         |
| Cost                 | **$0/month**                                                                                                                                                                                           |
| **Region**           | **The function must run in the database's region.** Measured in Step 9: 13.6 s from Nairobi versus **1.7 s from Dublin**, with `db_connect` falling from 2 150 ms to 18 ms. Same code, different place |

### Region rule (measured, not assumed)

Deploying ingest anywhere is not good enough. In the wrong region the loop exceeds a 10 s limit; in
the right one it takes 1.3–1.7 s warm, with a ~9 s cold start. `maxDuration` is 60 s, and a failed
ingest is never treated as an empty inbox — the queue retries and the unique keys prevent duplicates.

## Accepted risks

- **The pinger is a single point of failure.** If cron-job.org stops, ingestion stalls silently.
  Emails are not lost — they sit in the mailbox — but the app goes stale with no warning.
  Mitigation: a health check in the app that shows "last successful ingest" and turns red after
  30 minutes; Stage 7 verifies the pinger actually fires.
- **Free-tier limits.** Vercel Hobby is for non-commercial use; Supabase free pauses after a week of
  inactivity. Both are acceptable for a portfolio project and both are exit criteria.
- **Cold starts** add ~1–2 s per invocation. Irrelevant at this volume.

## Exit criteria

Move back to an always-on host when any of these becomes true:

1. Paying for hosting is acceptable.
2. Ingest latency under ~1 minute becomes a real requirement.
3. The pinger becomes unreliable in practice.
4. More than a handful of users depend on the product.

The ingest adapter does not change in any of those cases — only the trigger does.
