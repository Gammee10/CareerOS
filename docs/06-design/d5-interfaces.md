# D5 — Interfaces

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-24
**Scope:** how the browser, the server, the modules and the outside world talk — and what may change
without breaking something.

## 1. A challenge to the template, first

The template says: **write the OpenAPI contract before the code.**

For this product there is **one client**, it is deployed together with the server, and there are no
third-party consumers. An OpenAPI document would be a spec written for an audience of nobody, that
drifts from the code the moment someone forgets to regenerate it.

**What replaces it:** the contract *is* the code — **Zod schemas** that validate at the boundary and
generate the TypeScript types. One definition, used by the handler, the form, and the test. A wrong
shape fails at runtime and at compile time.

**When OpenAPI becomes right:** the moment anything outside this repo calls the API — a mobile app,
an agent, an integration. That is a decision for that day, and the Zod schemas are exactly what an
OpenAPI document would be generated *from*.

## 2. The three boundaries

| Boundary | Who talks | How | Contract lives in |
|---|---|---|---|
| **Browser ↔ server** | the Next.js client ↔ route handlers | HTTPS, session cookie | Zod schemas per route |
| **Server ↔ modules** | routes ↔ `intake` / `ledger` / `planning` / `delivery` | in-process function calls | TypeScript types exported by each module |
| **Server ↔ outside** | server ↔ Gmail, Supabase, scheduler | IMAP/SMTP, SQL, HTTPS | the adapter inside each module |

## 3. The route surface

Eleven routes. Three are machine-triggered and carry a bearer secret; the rest require a session.

| Route | Method | Auth | Idempotent by design? | Calls |
|---|---|---|---|---|
| `/api/ingest` | POST | **bearer** | yes — per message | `intake.ingest()` |
| `/api/digest` | POST | **bearer** | yes — per week | `delivery.sendIfDue()` |
| `/api/export` | POST | **bearer** | yes — per night | operator export |
| `/` | GET | session | — | `planning.listDue()` |
| `/review` | GET | session | — | `intake.listReview()` |
| `/review/[id]` | POST | session | yes — conditional update | `intake.resolveReview()` |
| `/applications` | GET | session | — | `ledger.list()` |
| `/applications` | POST | session | no — intentional duplicates allowed | `ledger.create()` |
| `/applications/[id]` | PATCH | session | yes — same value is a no-op | `ledger.update()` |
| `/due/[id]` | POST | session | yes — conditional update | `planning.complete/snooze()` |
| `/settings` | GET/POST | session | yes — same value is a no-op | `profiles` |

**Most user routes are naturally idempotent**, because the module doors use conditional updates
(D4.5). That is why there are no idempotency keys in the wire protocol: a double-click lands on
`WHERE state = 'open'` and the second one changes nothing. **The idempotency lives in the data layer,
where it cannot be forgotten.**

The one route that is *deliberately* not idempotent is `POST /applications` — S6 allows a genuine
second application to the same company, and the dedupe index only constrains email-created rows.

## 4. Error format

One shape, everywhere:

```json
{ "error": { "code": "invalid_date", "message": "That date cannot be parsed.", "field": "due_date" } }
```

| Status | Meaning | What the user sees |
|---|---|---|
| 400 | malformed input | the field is highlighted |
| 401 / 403 | no session / not your row | redirected to sign in, or "not found" — never "forbidden" for another user's data |
| 404 | does not exist **or is not yours** | "not found" — deliberately indistinguishable |
| 409 | conflict (already done, duplicate email) | a quiet message, not an error |
| 500 | our fault | "something went wrong, nothing was changed" |
| 503 | dependency down (Gmail, database) | "ingestion is paused, last sync 12 min ago" |

**403 for another user's row is not used** — returning 404 avoids confirming that a row exists.
Invariant 2 (RLS) makes this a defence-in-depth detail rather than the only protection.

## 5. What is versioned, and what is not

| Thing | Versioning rule |
|---|---|
| **Database schema** | expand and contract only (D4.7). Never a breaking change in one step |
| **Stored JSON** (`inbound.parsed`) | treated as a schema: add fields, never repurpose one. Old rows must still parse |
| **Internal HTTP routes** | **not versioned** — the client deploys with the server. A stale cached tab may break, and a reload fixes it |
| **Module interfaces** | not versioned — changed in the same commit as every caller, enforced by the compiler |

This is the honest position for a single-client app: versioning the HTTP API would be ceremony. The
thing that genuinely outlives a deploy is the **database and the stored data**, and that is where the
strict rule applies.

## 6. Rules for every outside system

| System | Timeout | Retry policy | What the user sees while it fails |
|---|---|---|---|
| **IMAP (Gmail)** | 20 s connect, 20 s fetch | No retry inside a run. The message stays `processing`, the lease expires, the next 5-minute run retries | Stale banner after 30 min |
| **SMTP (Gmail)** | 15 s | One retry inside the catch-up window (D4.2) | Nothing — the digest simply arrives later or not that week |
| **Postgres (Supabase)** | `statement_timeout = 5 s` | No automatic retry; the queue retries the whole job | "Something went wrong, nothing was changed" |
| **Supabase Storage** (export) | 60 s | One retry | Nothing visible; a failed backup is logged and surfaced in the freshness panel |

**No circuit breaker.** A circuit breaker protects a high-traffic service from hammering a dead
dependency. Here the caller runs every five minutes — **the scheduler is the circuit breaker**, and
adding another layer would be machinery without a job. If the failure rate of a dependency ever
matters, the heartbeat panel already shows it.

**Backoff:** only where a message is retried (the ingest queue, D4.1) — 0 s, 2 s, 5 s between
attempts, then dead-letter. Jitter is unnecessary at this volume.

## 7. Inbound email is our webhook

The template's inbound-webhook rules apply here almost word for word:

| Rule | How it applies |
|---|---|
| **Store raw first** | `inbound` is inserted with `raw_body` **before** any parsing happens |
| **Answer fast** | The poll returns after the insert; parsing happens in the same run but the row already exists |
| **Process after** | The queue claim is separate from the insert |
| **Handle duplicates** | unique `message_id` |
| **Handle late arrivals** | an email for an old application still updates it — states only move forward (D4.2) |
| **Handle unknown ids** | an unrecognised plus-code → `owner_id` cannot be resolved → the row is **ignored and logged**, never guessed |
| **Authenticity** | header checks are best-effort: the plus-code must be valid, and unknown senders only ever reach Review |

The "unknown id" rule is the one with teeth: **an email whose plus-code does not match a user is
discarded, not assigned to the only user in the system.** "Obviously it must be his" is how one
tenant's data ends up in another's.

## 8. Outbound with side effects

Only one exists: sending the digest. It follows the atomic-phase pattern from D4.6 — intent row
(`digests`, `sending`) → SMTP → result (`sent` / `failed`). **No outbox**, for the reasons in D4.6.

## 9. Pagination, briefly

Lists are capped at **100 rows** with a simple `limit`/`before` cursor on `created_at`. At one user
and tens of applications, pagination is a guardrail rather than a feature — but an unbounded list is
a bad habit to build into the first version.

## 10. What this deliberately does not have

No OpenAPI document, no API versioning, no rate limiting on user routes (one user), no API keys for
users, no GraphQL, no tRPC, no webhook signature verification (email has none we control), no circuit
breaker. Each is a real technique for a system with consumers, traffic, or dependencies we cannot
schedule — none of which this is.
