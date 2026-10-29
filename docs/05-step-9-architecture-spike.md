# Stage 5 · Step 9 — Architecture-risk spike

**Status:** 🟡 plan drafted, awaiting go-ahead
**Date:** 2026-10-22

## The assumption at risk

Every piece has been tested **on its own**, on this laptop:

- IMAP works (Spike 2)
- Parsing works (Spike 3)
- The queue works (Spike 5)
- The scheduler logic works (Spike 4)

**None of them has ever run together, in one invocation, in the place the product will run.**

The architecture says: _a scheduled HTTP call triggers one serverless function that opens IMAP, reads
new mail, writes to Postgres, parses, and closes — all inside a function time limit._

If that whole loop takes 12 seconds, the design is wrong before a single feature is written, and no
amount of good code fixes it.

## The question, in plain words

**Can one invocation do the entire ingest job — connect to Gmail, read, write to Supabase, parse,
finish — fast enough to fit in a serverless function's time limit?**

That is the number this spike produces.

## Why it is the riskiest assumption

| Failure                                               | Consequence                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The loop exceeds the function limit                   | Ingestion is cut off mid-run; message half-processed; the queue's retry handles it, but every run wastes the full budget |
| Supabase's pooler misbehaves from a serverless caller | Connections refused or exhausted, most often on the second request, not the first                                        |
| Cold start plus TLS plus IMAP plus Postgres           | Each is fast alone; together they may not be                                                                             |
| Concurrent triggers overlap                           | Two ingest runs at once, both claiming from the same queue                                                               |

## Part A — the loop, measured here (testable now, no accounts)

One script, one invocation's worth of work, real services:

1. Open IMAP to Gmail, fetch the newest message.
2. Insert it into `inbound` (the real Supabase project).
3. Claim it with the real `SKIP LOCKED` query.
4. Parse company/role/stage.
5. Insert the application and complete the job.
6. Measure **each step**, and the total.

Then repeat with **5 concurrent workers** to see whether the pooler holds up under overlap.

### Thresholds, fixed before running

| Total loop time (warm) | Reading                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| **< 5 s**              | Comfortable. A 10 s limit is safe, with room for the parser to grow |
| **5–9 s**              | Tight. Needs a longer limit or fewer round trips before Stage 7     |
| **> 10 s**             | The architecture does not fit. Redesign the invocation shape        |

## Part B — the same thing on Vercel (needs an account)

Part A measures the work. Part B measures the _place_: cold start, the function runtime, and whether
Supabase's pooler behaves from Vercel's network.

It requires a Vercel account and a deploy. Two honest options:

- **Do it now** — sign up with GitHub (~2 minutes), then `npx vercel` from this folder. Adds 20–30
  minutes and depends on npm behaving, which it did not for pip earlier.
- **Defer to Stage 7** — with the gate written down: _the first deploy must prove the ingest route
  connects to Supabase and completes inside the limit before any feature work begins._

Part A is still worth doing alone: if the loop takes 9 s on a fast laptop, Vercel will only make it
worse, and we would know before writing the app.

## Roles

| Who      | Does                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Me**   | Write the end-to-end script, run it against the real Gmail and Supabase, report per-step timings, run the 5-way concurrency check, delete the code |
| **User** | Choose Part B: now or deferred to Stage 7                                                                                                          |

## What this will not prove

- Reliability over hours, or behaviour when Gmail rate-limits us.
- Cost at volume — Step 6 covered that arithmetically.
- Anything about the UI.

## Part A result — FAIL against the threshold (13.6 s vs < 5 s)

Run 2026-10-22, from Nairobi, against real Gmail and real Supabase (eu-west-1).

| Run                                     | Total                          |
| --------------------------------------- | ------------------------------ |
| Cold (first contact with both services) | **37.8 s**                     |
| Sequential, median of 5                 | **13.6 s** (max 30.2 s)        |
| Concurrent, 5 at once, median           | **12.9 s** (wall clock 14.4 s) |

| Step                    | Median | Max     |
| ----------------------- | ------ | ------- |
| IMAP login (TLS + auth) | 3.40 s | 7.94 s  |
| IMAP fetch              | 1.66 s | 5.10 s  |
| Parse                   | 0 ms   | 0 ms    |
| Postgres connect        | 2.15 s | 11.93 s |
| Enqueue                 | 0.92 s | 1.18 s  |
| Claim                   | 1.34 s | 2.91 s  |
| Complete                | 1.40 s | 3.04 s  |

### Diagnosis — the work is trivial, the network is everything

Parsing is **0 ms**. Every other step is a network round trip, and there are seven sequential groups
across two TLS sessions (IMAP to Google, Postgres to `eu-west-1`), each carrying the full
Nairobi-to-internet latency. Nothing here is slow code.

Two of the round trips are pure waste:

- **Claim.** The row was inserted by this very invocation; it does not need to be re-selected and
  claimed. Claiming exists for _other_ workers and for retries.
- **Second commit.** The application insert and the status update can share one transaction.

### What this does and does not mean

It **does not** mean the architecture is broken. It means the architecture, as specified with four
separate statements, does not fit a 10-second limit _from this network_.

From a datacenter region beside Supabase (`eu-west-1`) and Gmail, the round-trip drops from
200–400 ms to 20–60 ms. The same loop should land at **1.5–3 s**. That is what Part B has to measure —
the number is a property of the _place_, not only of the code.

### Changes to adopt regardless of Part B

1. **Skip the claim** for a message this invocation just inserted — use `INSERT … RETURNING id`.
2. **One transaction** for the application insert plus the status update.
3. **Batch**: one invocation drains all new messages with one login and one connection, amortising
   the two expensive handshakes across N emails instead of paying them per email.
4. **`maxDuration` 60 s** and a function region near the database.

Projected from these alone: five round-trip groups instead of seven, roughly **6–7 s locally** and
**1.5–3 s from a datacenter**.

### The good news

- **Five concurrent connections to the pooler: no errors, no refusals.** The connection story works.
- Parsing costs nothing, so accuracy can be traded for nothing.
- Every step is understood and measurable — there is no mystery in this pipeline.

## Part B result — PASS: 1.7 s in Dublin, 8× faster

The same loop, deployed as a real Vercel function in **`dub1` (Dublin)**, beside Supabase in
`eu-west-1`. Six invocations, timed inside the function.

| Step               | Nairobi (Part A) | **Dublin (Part B)** | Change   |
| ------------------ | ---------------- | ------------------- | -------- |
| IMAP connect       | 3 400 ms         | **1 151 ms**        | −66%     |
| IMAP fetch         | 1 660 ms         | **525 ms**          | −68%     |
| Parse              | 0 ms             | **0 ms**            | —        |
| Postgres connect   | 2 150 ms         | **18 ms**           | **−99%** |
| Insert             | 920 ms           | **4 ms**            | −99.6%   |
| Write              | 1 400 ms         | **6 ms**            | −99.6%   |
| **TOTAL (median)** | **13 654 ms**    | **1 709 ms**        | **8×**   |
| Total (min–max)    | 13.6–30.2 s      | 1.27–9.3 s          | —        |

**The decisive number is `db_connect`: 2 150 ms → 18 ms.** Everything Postgres-related collapses to
nothing once the function sits beside the database. All remaining cost is IMAP — a TLS handshake and
a mailbox fetch against Gmail, from Europe.

### What this means

The architecture **fits**, with one condition that is now a hard rule:

> **The ingest function must run in the same region as the database.**

In `dub1`, a warm invocation is **1.3–1.7 s** — comfortable inside a 10 s limit and trivial inside
60 s. From Nairobi, the identical code takes 13.6 s and would fail. Nothing about the code changed
between the two runs; only the place did.

### Two caveats that must survive into Stage 7

1. **Cold start is ~9.3 s** before the function warms up — the first call after a period of idleness.
   Fine inside `maxDuration: 60`, and the 5-minute pinger keeps it warm in practice, but the first
   invocation after a deploy will be slow.
2. **One of six calls timed out** (IMAP handshake). A ~17% failure rate in a tiny sample is a warning,
   not a measurement. The design already absorbs it: the queue retries, the unique keys prevent
   duplicates, and the next scheduled run picks up whatever was missed. **A failed ingest must never
   be treated as an empty inbox** — that is the "silence looks like nothing due" failure mode again.

### Also confirmed

- Vercel serves SSO-protected URLs by default on new projects; the project setting must be disabled
  or the function returns a login page with HTTP 200. Recorded because it would waste an afternoon.
- Deployment via REST API works with no CLI and no npm — useful for later automation.
- The spike project was deleted after measurement.

## Verdict for Stage 5

| Question                              | Answer                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Is the architecture viable?           | **Yes, conditionally** — same-region deployment, `maxDuration` 60 s, retries |
| Is the number a property of the code? | **No** — it is a property of the place                                       |
| Does the $0 constraint hold?          | **Yes** — Vercel Hobby in one region, Supabase Free                          |
