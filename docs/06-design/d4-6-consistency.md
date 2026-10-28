# D4.6 — Consistency boundaries

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-24
**Scope:** which writes must happen together, which may happen later, and where the line sits between
the database and the outside world.

## 1. The rule

> **Claim in a transaction. Do the slow or external thing outside it. Record the result in another
> transaction.**

A transaction that waits on Gmail holds a lock for the duration of a TLS handshake, a mailbox search
and a network hiccup. That is how one slow dependency takes the whole system down. Every operation
that touches the outside world follows the three-phase pattern instead.

## 2. The three phases

| Phase | What it does | Duration | If it crashes here |
|---|---|---|---|
| **1. Reserve** | One short transaction: mark the row as being worked on, take a lease, set a timestamp | milliseconds | Nothing was reserved; next run starts cleanly |
| **2. Act** | The slow part, outside any transaction: IMAP, SMTP, parsing, upload | seconds | The reservation is stale; a lease timeout or `sending` recovery reclaims it |
| **3. Record** | One short transaction: write the outcome | milliseconds | The work happened but is unrecorded — the recovery path decides whether to repeat |

The lease (ingest) and the `sending` state (digest) exist precisely to answer phase 3's question:
*"did this happen, and may I try again?"*

## 3. Operations, phase by phase

### Ingest one email

| Phase | Action | Transaction? |
|---|---|---|
| 1 | Claim the `inbound` row: status `processing`, lease 60 s, `attempts + 1` | ✅ one statement |
| 2 | IMAP fetch (already done earlier, at insert time) → parse → decide confidence | ❌ outside |
| 3 | Insert or update the application, write the event, set `last_activity_at`, mark `inbound` `done` / `needs_review` | ✅ one transaction |

**Crash between 1 and 3:** the lease expires, another run claims it, `attempts` becomes 2, and the
unique keys make a repeat harmless.

### Send the digest

| Phase | Action | Transaction? |
|---|---|---|
| 1 | Claim the week: `UPDATE digests SET status='sending' WHERE … AND status='pending' RETURNING *` | ✅ one statement |
| 2 | Compose and send over SMTP | ❌ outside |
| 3 | `UPDATE digests SET status='sent', sent_at=now()` | ✅ one statement |

**Crash between 1 and 3:** the row is stuck in `sending`; after 10 minutes the recovery path marks it
`failed`, and one retry is allowed inside the 6-hour catch-up window. Worst case: **one duplicate
email**, never a missing one, never a loop.

### A user action (complete, snooze, edit, correct)

Single transaction, no external call — the whole thing is phase 1 and 3 collapsed:

```
update due_items set state='done' where id=$1 and owner_id=$2 and state='open'
  → 0 rows: someone/sync already changed it
  → 1 row: write the event, commit
```

### Nightly export

1. Query the data (no transaction needed beyond a consistent snapshot).
2. Upload to Storage — **outside** any transaction.
3. Log success.

A failed upload loses one night's backup; it never blocks a user action.

## 4. What must be atomic, and what may lag

| Must be one transaction | May be eventual |
|---|---|
| Application write + event + `last_activity_at` | Due-item generation (`sync()` runs on the next ingest or digest) |
| Inbound `done` + application write | Health/heartbeat timestamps |
| Due item state + its event | Nightly reconciliation and export |
| Digest `sent` + `sent_at` | Any future analytics |
| Correction + `stage_corrected` event | — |

The "may lag" column is deliberately short. Everything a user can see on the next page load is
atomic; everything else can be minutes late without anyone noticing.

## 5. Why there is no outbox (yet)

An outbox table exists to solve one problem: *a message must be sent when data changes, but the send
cannot happen inside the transaction.* We have exactly one outbound message — the weekly digest — and
it is already its own operation with its own intent row (`digests`). It **is** the outbox for the only
thing we send.

An outbox becomes necessary the moment a **data change** must trigger a send — "email me when an
interview is scheduled", "notify me when a rejection arrives". That feature does not exist in v1. When
it does, the pattern is already decided: write an `outbox` row in the same transaction, let a relay
drain it, and make the consumer idempotent.

## 6. Enforcement

| Rule | How it is checked |
|---|---|
| No IMAP, SMTP or HTTP inside a transaction | **Fitness function in D8** — a check that these calls never appear inside a `db.transaction(` block |
| Every mutation writes its event in the same transaction | Test: throw after the state write, assert the event is absent too |
| No operation holds a transaction open across a network wait | Statement timeout (5 s) makes a violation fail loudly rather than hang |

The third row is the pragmatic one: with `statement_timeout = 5s`, a transaction that tries to wait on
the network will abort itself, which is a better alarm than a code review comment.

## 7. The one place this is imperfect

If phase 3 fails after phase 2 succeeded — the email was sent but the row was not updated — the system
will eventually retry and may send twice. That is the accepted trade from D4.2: **at-least-once
delivery with a bounded duplicate**, because a missing digest is silent and a duplicate digest is
merely annoying.
