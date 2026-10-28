# ADR 0005 — One Postgres table is the job queue

**Status:** Accepted — 2026-10-22
**Evidence:** Spike 5 (6/6 tests against Supabase Postgres)
**Related:** Stage 4 reliability requirements

## Context

Forwarded mail must be persisted before parsing, retried on failure, dead-lettered when hopeless, and
never turned into two applications. A managed queue (SQS, Redis) would cost money and add a
dependency for a product handling a few dozen messages a month.

## Decision

A single `inbound` table with `status`, `attempts`, `next_attempt_at`, `lease_until`, and a unique
index on `message_id`. Workers claim with `FOR UPDATE SKIP LOCKED` inside a transaction. Three
attempts, then `dead`.

## Consequences

- **The unique index is the safety net, not the lease.** Spike 5 T6 proved that a slow worker and a
  reclaiming worker both call `complete()`, and the data stays correct only because
  `applications.message_id` is unique and inserts use `ON CONFLICT DO NOTHING`.
- **Every downstream effect must be idempotent** for the same reason: a notification sent from
  `complete()` can fire twice.
- The lease only prevents stuck messages and wasted work.
- No broker to run, no extra bill, no network hop to a third party.

## Rejected

- **Managed queue**: real cost and a new failure mode for negligible volume.
- **Process-in-memory queue**: loses work on every deploy or crash.

## Revisit when

Throughput exceeds what one Postgres can serve (roughly thousands per minute) — far beyond this
product's needs.
