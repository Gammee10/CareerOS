# D7 — Challenge: what could be wrong?

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-26
**Scope:** score the big decisions against the drivers, take every part and arrow through five failure
questions, threaten the trust boundaries, and imagine the project already dead.

The rule for this document: **a failure table that creates no tickets is decoration.** Every response
below ends in a named ticket (Stage 8) or a test (Stage 10).

---

## 1. The decisions, scored in words

No invented precision — good / ok / bad against the three drivers that discriminate.

| Decision            | Chosen                           | Alternative                     | Cost (D1.7) | Correctness (D1.3/1.5)  | Simplicity | Verdict                                                                                                   |
| ------------------- | -------------------------------- | ------------------------------- | ----------- | ----------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| Hosting             | Serverless, one region           | Paid always-on worker           | **good**    | ok (cold starts)        | ok         | chosen stands                                                                                             |
| Job queue           | Postgres table                   | Managed queue (SQS/Redis)       | **good**    | good                    | **good**   | chosen stands                                                                                             |
| Parser              | Deterministic rules              | LLM per email                   | **good**    | ok (recall ceiling)     | good       | chosen stands                                                                                             |
| Module split        | Four deep modules                | Seven capability modules        | good        | good                    | **good**   | chosen stands                                                                                             |
| Digest delivery     | At-least-once, bounded duplicate | At-most-once (mark before send) | good        | **bad** (silent misses) | good       | **chosen stands; ADR 0009**                                                                               |
| Auth                | Supabase Auth                    | Clerk / Auth.js                 | **good**    | good                    | ok         | chosen stands                                                                                             |
| "Do nothing" option | —                                | Manual spreadsheet + calendar   | **good**    | **bad**                 | **good**   | _This is the real competitor._ Rejected because the product's whole claim is that the check costs nothing |

**The one honest admission in this table:** for a single user, "do nothing" scores well on cost and
simplicity. The product only wins if the check really is cheaper than remembering — which is exactly
what Stage 3 measured and what the due-list design is trying to protect.

---

## 2. Failure table

Every box and arrow, asked the same five questions. **Slow, down, duplicated, out of order, wrong.**

| Part / arrow              | Slow                                                      | Down                                                                 | Duplicated                                          | Out of order                                                             | Wrong                                                                   |
| ------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Browser → pages**       | loading skeleton                                          | offline/error page; nothing lost — actions are server-side           | double submit → conditional update makes it a no-op | stale tab edit → rejected by `WHERE state=`; user told "already changed" | Zod rejects at the boundary (400)                                       |
| **Pages → Postgres**      | `statement_timeout` 5 s → 503                             | 503 "nothing was changed"                                            | reads are harmless                                  | —                                                                        | RLS + typed queries                                                     |
| **Scheduler → ingest**    | two runs overlap → `SKIP LOCKED` claims each message once | **silent staleness** → heartbeat banner after 30 min                 | second run finds an empty queue                     | —                                                                        | bad token → 401, nothing read                                           |
| **Scheduler → digest**    | overlapping runs → unique week + conditional claim        | no digest that week; catch-up window is the safety net               | second run sees `sending`/`sent`                    | —                                                                        | bad token → 401                                                         |
| **Ingest → Gmail (IMAP)** | 20 s timeout; lease expires; next run retries             | run fails, `job_runs` records it, banner turns red                   | `message_id` dedupe → one row                       | late email still updates; stages only move forward                       | **low confidence → Review, never silent filing**                        |
| **Digest → Gmail (SMTP)** | 15 s timeout                                              | `failed` status; one retry inside 6 h                                | **bounded duplicate after a crash** (accepted)      | —                                                                        | content built from current data; a wrong digest is visible and harmless |
| **Ingest → Postgres**     | timeout → run fails, retried                              | run fails, retried                                                   | unique keys absorb it                               | state machine rejects backwards moves                                    | invariants (D4.3)                                                       |
| **Export → Storage**      | 60 s timeout                                              | backup missed; logged and surfaced                                   | same-night file overwritten                         | —                                                                        | restore drill is the only real check                                    |
| **Postgres (box)**        | slow query → 503                                          | **everything stops**; restore path is the export                     | —                                                   | —                                                                        | —                                                                       |
| **Auth (box)**            | slow sign-in                                              | **nobody can sign in** — an honest failure, not a stale-data failure | —                                                   | —                                                                        | —                                                                       |
| **Gmail account (box)**   | throttled reads                                           | **R2: ingestion and delivery both stop**                             | —                                                   | —                                                                        | —                                                                       |

**The three rows that matter most**, ranked by damage: Gmail account lost (unrecoverable), Postgres
lost (restorable but expensive), scheduler silently dead (invisible).

---

## 3. Tickets this table creates

| Ticket                                       | From                           | Test that proves it                                 |
| -------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| T1 Heartbeat + stale banner + `/status`      | Scheduler down                 | clock-shifted test on the freshness calculation     |
| T2 Dead-letter visibility and count          | IMAP failure, poison message   | 3 failing attempts → visible in `/status`           |
| T3 Lease recovery                            | IMAP slow / worker dies        | kill a worker mid-job → reclaimed (Spike 5 T3)      |
| T4 Unique-key replay tests                   | Duplicated delivery everywhere | replay the same message 10×                         |
| T5 RLS cross-user test                       | "Wrong" on every table         | two users; cross-read must return 0 rows            |
| T6 `statement_timeout` and 503 copy          | Slow database                  | set a 6 s query; assert 503 and no partial write    |
| T7 Kill switches                             | Broken ingest running          | flip the flag; assert no mailbox read               |
| T8 Backup restore rehearsal                  | Export wrong / missing         | restore into a scratch project, once                |
| T9 Unknown plus-code → discard and log       | Forged forward                 | send with an unknown code; assert no row is created |
| T10 Digest catch-up window                   | SMTP down                      | clock tests at −1 h, +1 h, +7 h                     |
| T11 CSRF protection on state-changing routes | Browser boundary               | POST without the token → 403                        |

Eleven tickets. They are the first thing Stage 8 orders — **before any feature work**, because each
one is a way the product lies to its user.

---

## 4. Threat model — the five trust boundaries

| Boundary                  | Threat                                                        | Mitigation                                                                                                                                    | Residual                                            |
| ------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **B1 Browser → server**   | Session hijack, CSRF, XSS via rendered email content          | HttpOnly cookies, Supabase session, CSRF token on every state-changing POST, **email content rendered as text, never as HTML**                | Low                                                 |
| **B1**                    | Clickjacking / embedding                                      | frame-ancestors CSP                                                                                                                           | Low                                                 |
| **B2 Scheduler → ingest** | Anyone on the internet can call it: DoS, cost, mailbox reads  | 32-byte bearer token compared in constant time; **no data in the response**; no mailbox work without a valid token; rate limit per IP         | **Medium** — a public endpoint is a public endpoint |
| **B3 Server → Gmail**     | Credential theft grants mailbox access                        | app password in env only, never logged, never in the client bundle, revocable                                                                 | Medium (ADR 0001, L3)                               |
| **B4 Email → ingest**     | **Forged forwards**, junk, HTML/JS payloads, huge attachments | unknown plus-code → discarded; unknown sender → Review; **parse text only**; hard cap on message size; never execute or render remote content | Medium — email is untrusted by definition           |
| **B5 Server → Supabase**  | Service-key leak = full database                              | server-only env, never bundled, RLS as a second wall for user paths, rotate if exposed                                                        | Low                                                 |

**The B4 mitigation deserves emphasis:** the app renders email-derived text — subjects, snippets — so
**that text is attacker-controlled**. Rendering it as HTML anywhere would be a stored-XSS hole with
the user's own session as the prize. It renders as text, always.

---

## 5. Pre-mortem — it is six months later and CareerOS failed

| #   | Why it failed                                                                      | Likelihood      | Early signal                                     |
| --- | ---------------------------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| 1   | **The builder stopped.** Third weekend, then a month, then guilt                   | **Highest**     | No commits for 8 days                            |
| 2   | Forwarding was never set up, or broke silently, so the app was empty               | High            | Time-to-first-application > 10 min; zero inbound |
| 3   | The parser filed wrong companies; the user stopped trusting the list               | Medium-high     | Review queue grows; audit finds > 2% wrong       |
| 4   | The digest had nothing to say — 11 of 15 emails carry no date — so it became noise | **Medium-high** | Digests with 0 items; user stops opening         |
| 5   | The pinger died and nobody noticed for weeks                                       | Medium          | Stale banner ignored                             |
| 6   | Gmail disabled the mailbox                                                         | Low-medium      | Auth failures (RB6)                              |
| 7   | Free tier changed under us                                                         | Low             | Vercel/Supabase notices                          |
| 8   | Scope crept: analytics "just one screen", then a pipeline board                    | Medium          | Stories beyond the seven                         |

**Two of these are product risks, not engineering risks** — #2 and #4 — and both were visible in
Stage 3's evidence. The mitigation is not architectural: it is to **make the empty state informative**
("nothing due this week" is a truthful, useful answer) and to **measure time-to-first-application**.

#1 remains the most likely failure of all, which is why Stage 7 starts with a walking skeleton.

---

## 6. The review — and what we cannot do

The template asks for a second person to read the pack for 45 minutes and try to break it. **There is
no second person.** Honest substitutes, in descending value:

1. **This document's adversarial pass** — the agent taking the opposing position, which is what
   produced the "do nothing" admission and the pre-mortem.
2. **The owner reading the pack cold**, with the drivers first.
3. **A later red-team pass during Stage 9**, against the built system rather than the paper.

**The limitation, stated:** an author reviewing their own design has a blind spot that no checklist
removes. The cheapest real fix is to show the pack to any technical friend for 20 minutes. That is
the owner's call, not something a document can supply.

---

## 7. ADR produced here

| ADR                                         | Decision                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| [0009](../adr/0009-at-least-once-digest.md) | Digest delivery is at-least-once, with a bounded duplicate after a crash |
