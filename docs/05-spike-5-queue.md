# Spike 5 — Can a database do the job of a queue?

**IDs:** U7
**Box:** half a day
**Status:** 🟡 plan drafted, awaiting go-ahead
**Date:** 2026-10-22

## The question, in plain words

When a forwarded email arrives, it must be **written down before anything else happens**, then
processed. If the parser crashes halfway, the email must not vanish. If the same email arrives
twice, two applications must not appear.

A real queue costs money. The question: **can one database table do the job** — safely — with no
Redis, no SQS, no broker?

## Why it matters

Stage 4 already promised four things that a naive implementation breaks:

| Requirement                              | What breaks it                                              |
| ---------------------------------------- | ----------------------------------------------------------- |
| Raw message persisted **before** parsing | Parsing inline on arrival; a crash loses the mail           |
| Retries with backoff                     | A parser bug retried forever in a tight loop                |
| Dead-letter after N attempts             | One poisonous email blocks the queue forever                |
| **No duplicate application**             | Two workers, or a redelivery, both insert                   |
| Parser down ⇒ rows show "pending"        | A missing row is silently rendered as "nothing due" — a lie |

The last one is the dangerous one: for a reminder product, **silence caused by a bug looks exactly
like silence caused by no deadlines.**

## What can actually be tested

### Part A — the state machine (testable now, no accounts)

SQLite, the only database available without an account. Five failure-mode tests:

| #   | Test                                      | Pass looks like                                               |
| --- | ----------------------------------------- | ------------------------------------------------------------- |
| T1  | Same `Message-ID` enqueued 10×, 4 workers | exactly **1** application                                     |
| T2  | 50 messages, 4 concurrent workers         | **50** processed, 0 duplicates, 0 lost                        |
| T3  | Worker killed mid-message, lease expires  | message reclaimed, processed once, `attempts = 2`             |
| T4  | Parser always throws                      | 3 attempts, then **dead-letter**; nothing silently disappears |
| T5  | Backoff respected                         | no retry before `next_attempt_at`                             |

Proposed mechanics: one table with `status` (`pending` / `processing` / `done` / `dead`),
`attempts`, `next_attempt_at`, `lease_until`, and a **unique index on `message_id`**. Claims happen
inside a transaction; the lease is 60 s; three attempts, then dead-letter.

### Part B — the part SQLite cannot prove

**SQLite allows one writer at a time**, which is stricter than Postgres. That means T2 cannot fail on
SQLite the way it can on Postgres: two workers cannot both grab the same row, because the second is
blocked at the file level.

In Postgres, that protection comes from `SELECT … FOR UPDATE SKIP LOCKED`, and it must be verified
against a real database. As with Spike 4, that requires a free-tier account (Neon or Supabase).

**Honest position:** Part A proves the state machine, the idempotency rule and the recovery
behaviour. It does **not** prove claim contention. If Part B is deferred again, the Stage 7 walking
skeleton must include a concurrency test against the real database before the queue is trusted.

## Decision thresholds

| Result                        | Decision                                                     |
| ----------------------------- | ------------------------------------------------------------ |
| Part A passes all five        | One table is sufficient by design; no external queue in v1   |
| Any duplicate or lost message | The design is wrong before we build it — stop and redesign   |
| Part B deferred               | Recorded as a Stage 7 gate, with the exact test written down |

## Roles

| Who      | Does                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| **Me**   | Build the throwaway queue, run the five failure tests, report numbers, delete the code |
| **User** | Decide whether Part B (a real Postgres account) happens now or is deferred again       |

## What I expect to fail first

Test T3 is the one I would bet against. Reclaiming a message from a dead worker is where
implementations usually get it wrong — either the lease never expires (message stuck forever) or it
expires while the worker is merely slow (two workers, duplicate application). The lease is the whole
problem, and it is why the queue deserves a spike rather than a guess.

## Result — 6/6 passed against real Postgres (Supabase)

Tested against a real Supabase Postgres project, four worker threads, `FOR UPDATE SKIP LOCKED`
claims, a 3-second lease, and three attempts before dead-letter.

| #   | Test                                             | Result                                                                  |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| T1  | Same `Message-ID` enqueued 10×                   | **1 application**, 1 inbound row                                        |
| T2  | 50 messages, 4 concurrent workers                | **50 done, 0 duplicates, 0 lost**, 1.37 msg/s                           |
| T3  | Worker killed mid-message                        | reclaimed after lease expiry, `attempts = 2`, **1 application**         |
| T4  | Permanently poisonous message                    | 3 attempts, then **dead**, 0 applications, **nothing stuck**            |
| T5  | Backoff                                          | first retry immediate (policy), second waits ~2 s, **not picked early** |
| T6  | Worker _slow_, not dead — lease expires mid-work | two workers completed it, **still 1 application**                       |

### What this actually proves

**The lease is not the safety net. The unique index is.**

T6 is the important one. A worker whose lease expired while it was still alive _did_ have its message
reclaimed by a second worker, and both called `complete()`. The application count stayed at one
because `applications.message_id` is unique and the insert uses `ON CONFLICT DO NOTHING`.

So the design is belt-and-braces:

- the **lease** prevents wasted work and stuck messages;
- the **unique index** prevents wrong data even when the lease fails.

That matters beyond the queue: **any downstream side effect must be idempotent too.** If `complete()`
sends a notification or an email, T6 would have sent it twice. Stage 6 must apply the same rule to
whatever happens after the row is written.

### Throughput, and what it means

50 messages took **36.6 seconds** with four workers ≈ **1.37 msg/s** — roughly 700 ms per message,
almost entirely network round-trip between Nairobi and `eu-west-1`. It is latency-bound, not
lock-bound: the database was never the bottleneck.

For this product that is enormous headroom (a heavy user forwards ~30 emails a month). The lesson is
narrower: **run the worker in the same region as the database**, or pay that latency on every job.

### Design rules for Stage 6

1. One table, `status` + `attempts` + `next_attempt_at` + `lease_until`.
2. Unique index on `message_id` in both `inbound` and `applications`; inserts use `ON CONFLICT DO NOTHING`.
3. Claim with `FOR UPDATE SKIP LOCKED` inside a transaction.
4. Lease comfortably longer than the p99 processing time (60 s, not 3 s).
5. Three attempts with backoff, then dead-letter — never infinite retry.
6. **Every consumer of a completed job must be idempotent**, because double-completion is survivable
   by design.

### Caveats

- Four threads in one process on one machine. No network partitions, no region failover.
- Free-tier connection limits were not stressed.
- The test schema was created by the spike script; the real migration belongs in Stage 7.
