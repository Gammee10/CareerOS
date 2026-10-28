# ADR 0009 — Digest delivery is at-least-once

**Status:** Accepted — 2026-10-26
**Related:** ADR 0006 (idempotency), D4.2 (digest states), D4.6 (atomic phases), D7

## Context

The digest is the only channel that brings the user back, and D1.2 says *exactly one per user per ISO
week*. Between "we decided to send" and "we know it was sent" there is a window. A crash inside that
window forces a choice, and no implementation can avoid the choice — it can only pick a side.

## Decision

**At-least-once, with a bounded duplicate.**

- Claim the week: `pending → sending` in one statement.
- Send over SMTP outside any transaction.
- Record the result: `sending → sent`.
- A row stuck in `sending` for more than 10 minutes is marked `failed` by recovery, and **one** retry
  is allowed inside the 6-hour catch-up window.

## Consequences

- **Worst case: one duplicate email, once, after a crash.** Never a loop, never a silently missing
  digest.
- The database unique key `(owner_id, iso_year, iso_week)` still guarantees one *row* per week; the
  duplicate is a second send attempt, not a second row.
- The "exactly one" wording in the drivers is amended in spirit: **exactly one in normal operation,
  at most two after a crash**.

## Rejected

- **At-most-once** (mark sent before sending): a crash loses the week with no trace. For a reminder
  product, silence is the worst failure — it is indistinguishable from "nothing to do".
- **Two-phase with a delivery receipt**: Gmail gives none we can rely on. The complexity would buy a
  guarantee the transport cannot provide.

## Revisit when

A delivery service with real receipts is adopted (Resend, with webhooks). At that point the send can
become effectively exactly-once, because the provider reports the outcome rather than us inferring it.
