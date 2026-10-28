# D4.5 — Concurrency

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-24
**Scope:** what happens when two things touch the same row at the same moment, and which mechanism
each case uses.

## 1. What concurrency actually exists here

This is a single-user product. There is no crowd, so designing for high contention would be
over-engineering. But three kinds of collision are real:

| Source | Example |
|---|---|
| **Overlapping scheduled runs** | A slow ingest run and the next 5-minute trigger, or a digest trigger landing twice |
| **Retries and redelivery** | Gmail returns the same message twice; a crashed worker's lease expires and another worker reclaims it |
| **The same person, twice** | Two tabs open; a double-click on "done"; a click that lands while `sync()` is running |

Everything below addresses one of those three.

## 2. The mechanisms, and when each is used

| Mechanism | Used for | Why not something else |
|---|---|---|
| **Unique constraint** | "This must exist at most once" — `message_id`, digest week, due-item key | Strongest layer; cannot be bypassed by a bug |
| **Partial unique index** | "At most one *email-created* application per company+role" | Allows the manual "add anyway" path from S6 that a full unique index would forbid |
| **Conditional update** (`WHERE state = expected`) | State transitions: complete, snooze, claim a digest | Detects the race in the same statement that performs it; no read-then-write gap |
| **`FOR UPDATE SKIP LOCKED`** | Queue claims | Already measured in Spike 5: four workers, zero duplicates |
| **Conflict-and-retry** (`ON CONFLICT` → re-read) | Find-or-create for applications | Turns a rare race into a normal code path instead of an error |

**Not used, deliberately:** optimistic version columns, advisory locks, and `SERIALIZABLE` isolation.
Each is a tool for contention that does not exist here. If contention ever appears, the conditional
updates and unique indexes are the seams where it would be added.

## 3. Scenario by scenario

| # | Two things at once | Result without care | Mechanism | Test |
|---|---|---|---|---|
| 1 | Two ingest runs start together | Both claim the same email | `SKIP LOCKED` claim in a transaction | Spike 5 T2 replay: 50 messages, 4 workers, 0 duplicates |
| 2 | The same email is delivered twice | Two applications | Unique `inbound.message_id` | enqueue the same message 10× → 1 row, 1 application |
| 3 | Two *different* emails, same company and role, processed together | Two applications | Partial unique index on `(owner_id, dedupe_key) where source='email'`; second insert conflicts, code re-reads and updates | concurrent insert test: both succeed, one row |
| 4 | Worker dies mid-job; another reclaims after the lease | Double processing | Unique indexes make the second write a no-op (Spike 5 T6) | kill worker, assert 1 application |
| 5 | User double-clicks "done" | Two events, confusing state | `UPDATE … WHERE state = 'open'` | second click affects 0 rows, second event not written |
| 6 | Snooze expires while the user completes the item | Item reopens after completion | Same conditional update; expiry only moves `snoozed → open` | clock test: complete at the same instant as expiry |
| 7 | Two digest triggers fire together | Two digest rows, two emails | Unique `(owner, year, week)` + conditional claim `WHERE status='pending'` | two concurrent digest runs → one row, one send |
| 8 | Crash mid-send | Unknown whether it sent | `sending` state + 10-minute recovery (D4.2) | fault-injection test |
| 9 | User edits a stage while an email arrives | Email overwrites the correction | Intake may only move stages **forward**; `rejected`/`withdrawn` are terminal | correction-then-old-email test |
| 10 | User edits company/role while an email arrives | Email overwrites the edit | Intake sets these **only on create**, never on update | edit-then-email test |
| 11 | `sync()` regenerates items while the user is editing one | Duplicate or resurrected item | Unique `(owner_id, key)`; user state is never regenerated (D4.4) | run `sync()` 5× during edits → 1 item, state preserved |

## 4. The decision this step changes

**D4.1 chose "duplicates prevented by code, not the database."** Scenario 3 shows that code alone has
a race: two concurrent inserts both find nothing. That is fixed without giving up S6's "add anyway":

```sql
create unique index applications_email_unique
  on public.applications (owner_id, dedupe_key)
  where source = 'email';
```

- Email-created applications: **at most one per company+role per owner**, enforced by the database.
- Manual applications: unconstrained, so a genuine second application to the same company is possible.

Intake's find-or-create becomes: try insert → on conflict, re-read and update. That is a normal path,
not an error, and it is the standard upsert pattern.

**This is a strengthening of D4.1, not a contradiction** — the earlier weakness was accepted because
the alternative blocked "add anyway"; the partial index gives both.

## 5. Isolation and transactions

- **Read committed** (Postgres default) is sufficient. Nothing here reads a value it later relies on
  across statements without a conditional update or a lock.
- Every state transition is **one short transaction**: the conditional update, the event insert, and
  `last_activity_at` together (invariant 17).
- **No external call inside a transaction.** IMAP and SMTP happen outside; this is invariant 27 and
  becomes a fitness function in D8.

## 6. The rule that keeps this simple

> **Make the database refuse the bad state, rather than asking code to avoid it.**

Every row in §3 ends in a constraint or a conditional update — something that fails loudly at the
moment of the race rather than quietly afterwards.
