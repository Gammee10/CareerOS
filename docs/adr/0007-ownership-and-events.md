# ADR 0007 — Ownership on every row, events beside current state

**Status:** Accepted — 2026-10-22
**Related:** [principles.md](../principles.md) (seams), Stage 4 (out-of-scope analytics)

## Context

v1 has one user. Two later changes are expensive once real data exists: introducing ownership, and
deriving history or analytics. Both are cheap now and painful later.

## Decision

1. **`owner_id` on every user-owned row from the first migration**, even though v1 has one user.
2. **An append-only `events` table beside the current state.** Every state change — created, stage
   changed, completed, snoozed, dismissed — writes an event row in the same transaction as the state
   update.
3. Current state stays denormalised in the main tables; queries never reconstruct state from events.

## Consequences

- Multi-user becomes a filter, not a migration.
- Analytics and the application timeline become **new readers of an existing table** instead of schema
  changes — the two features Stage 4 cut.
- Undo and audit come almost free.
- Cost: one extra insert per mutation and the discipline to always write the event in the same
  transaction. Skipping it is the failure mode to watch in review.

## Explicitly not doing

Full event sourcing. State lives in the tables; events are a history log, not the source of truth. A
CQRS design would be an order of magnitude more machinery for a product with one user.
