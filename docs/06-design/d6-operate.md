# D6 — Operate: run it, see it, pay for it

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-26
**Scope:** how we know it works, what we can see when it doesn't, how it deploys and rolls back, what
breaks at 10×, and the runbook for each failure.

## 1. Three SLIs — and the honest caveat

With one user, service-level indicators are computed from a handful of events a week. They are
**targets we check weekly**, not statistical guarantees. Pretending otherwise would be numerology.

| # | SLI | Target (SLO) | Measured from |
|---|---|---|---|
| **S1** | **Ingest freshness** — share of time the last successful ingest is under 30 minutes old | **99% of the week** | `job_runs` timestamps |
| **S2** | **Digest delivery** — weeks with exactly one successful digest | **100% of weeks** | `digests` rows |
| **S3** | **App responsiveness** — page loads completing under 2.5 s | **99%** | Vercel analytics + client timing |

**Why these three:** S1 is the one that fails silently and poisons everything downstream. S2 is the
only channel that brings the user back. S3 is the only thing the user feels directly.

**Not an SLI:** parser accuracy. It is a quality property measured by a weekly audit (A2), not a
service level — a fast, available system that files wrong data is still broken, and no percentage
captures that.

## 2. The questions we must answer at 3 a.m.

| Question | Answered by | Where |
|---|---|---|
| Is ingestion running at all? | Last run start/finish, gap since | `/status` panel + `job_runs` |
| Is it running but failing? | Last N run outcomes and the error | `job_runs.error` |
| What is stuck? | Counts of `processing` past lease, `pending` past backoff, `dead`, `needs_review` | `/status` |
| Did this week's digest go out? | Digest row for the current ISO week | `/status` |
| Is the database up and how big is it? | Connection error rate, row counts | Supabase dashboard (manual) |
| Did last night's export succeed? | Export run row + file listing | `/status` |
| What changed recently? | Deploy list with timestamps | Vercel dashboard |
| Was it us or an outside service? | Dependency name on every error | structured logs |

**The `/status` page is the primary instrument**, because Vercel's free-tier log retention is short
(hours, not days). Anything we need to know more than an hour later must be in the database, not in a
log stream.

### Decision — do we store job runs in the database?

| Option | Strength | Weakness |
|---|---|---|
| **A. A `job_runs` table** (chosen) | Survives log expiry; answers "was it running at 3 a.m." a week later; powers the freshness banner | One more table and two writes per run |
| B. Rely on Vercel logs | No schema change | Logs expire in hours; the question you ask at 3 a.m. is answered the next morning by nothing |

**Recommendation: A.**

```sql
create table public.job_runs (
  id          bigserial primary key,
  job         text not null check (job in ('ingest','digest','export')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  outcome     text check (outcome in ('ok','partial','failed')),
  counts      jsonb not null default '{}'::jsonb,   -- fetched, filed, reviewed, dead
  error       text
);
create index job_runs_recent_idx on public.job_runs (job, started_at desc);
```

Retention: **90 days**, purged by the same housekeeping as D4.7.

## 3. Logs and metrics

- **Structured logs**, one JSON line per request: `request_id`, `route`, `outcome`, `duration_ms`,
  and `dependency` when it failed. **Never the email body, subject, or address** (D4.7 tier 2).
- **Metrics:** none beyond `job_runs` and `/status`. A metrics pipeline for one user is a toy.
- **Errors:** every unexpected exception logged with route and dependency; a 500 without a log line is
  a bug in the logging, not just in the code.

## 4. Deploy, rollback, and the two kill switches

| | |
|---|---|
| **Environments** | **production and local only.** No staging — a second environment for one user is cost without a decision |
| **How it deploys** | `git push` → Vercel build → deploy. Migrations run as a separate step **before** the code deploy |
| **Migration rule** | additive only (D4.7). A destructive migration never ships in the same deploy as the code that needs it |
| **Rollback (code)** | Vercel's instant rollback to the previous deployment |
| **Rollback (schema)** | forward-only. With expand-and-contract, the old code still runs against the new schema, so code rollback is safe |
| **Kill switch 1** | `INGEST_PAUSED=true` — `/api/ingest` returns 200 immediately, nothing is read |
| **Kill switch 2** | `DIGEST_PAUSED=true` — no digest is composed or sent |
| **Feature flags** | none. Two environment booleans are enough for a product with this surface |

The kill switches exist because a broken ingest that keeps running can do more damage than one that
stops. They are environment variables, not rows, so they work even when the database is the problem.

## 5. Cost and capacity at 10×

The arithmetic from Step 6, run against the design:

| At 10 users | Value | What it means |
|---|---|---|
| Ingest runs / month | 8,760 — **unchanged** (one mailbox) | Compute does not scale with users |
| Database size / year | ~30 MB | 6% of the 500 MB limit |
| Digest sends / month | 40 | Gmail fine; reputation concern starts at ~400 |
| Cost | **$0** | — |

**What actually breaks first at 10×, in order:**

1. **Manual forwarding verification** — every new user needs a human to click a confirmation email
   (ADR 0001, L5). This is the first real wall, and it is a *product* limit, not a technical one.
2. **Vercel's non-commercial term** — ten friends is still personal; a product is not.
3. **Gmail sending reputation** — 40/month is nothing; the ceiling is far away but real.

**The fix, when it is needed:** a domain (~$12/year) plus Resend's free tier removes (1) and (3);
Vercel Pro ($20/month) removes (2). Total ≈ **$21/month at 100 users** — the number from Step 6.

## 6. Runbook stubs

Four lines each: **symptom → check → action → escalate.**

### RB1 — Ingestion not running
- **Symptom:** `/status` shows last ingest older than 30 minutes; the app banner is red.
- **Check:** is the scheduler job still active in cron-job.org? Does `/api/ingest` return 200 with a bearer token?
- **Action:** re-enable the scheduler job; if the token rotated, update both sides. Data is not lost — mail waits in Gmail.
- **Escalate:** none. Single owner.

### RB2 — Ingestion running but failing
- **Symptom:** `job_runs` shows `failed` repeatedly with the same error.
- **Check:** the error text — IMAP auth (app password revoked?) or a parser exception on one message.
- **Action:** for auth, generate a new app password and update the env var. For a poison message, let the queue dead-letter it after 3 attempts and fix the parser later.
- **Escalate:** none.

### RB3 — Digest did not send
- **Symptom:** no `digests` row for the current ISO week after Monday 14:00 local.
- **Check:** `job_runs` for `digest`; SMTP error; whether the row is stuck in `sending`.
- **Action:** wait for the 10-minute recovery, then let the next hourly run retry inside the catch-up window. If the row is `sent` and the email never arrived, check Gmail's sent folder — that is a delivery problem, not ours.
- **Escalate:** none.

### RB4 — Database unreachable
- **Symptom:** 503s everywhere; ingest failing with a connection error.
- **Check:** Supabase dashboard status; project paused for inactivity (unlikely while ingest runs).
- **Action:** resume the project in the dashboard; verify the connection string is unchanged.
- **Escalate:** Supabase support (community).

### RB5 — Scheduler dead
- **Symptom:** identical to RB1 — by design, because the two are indistinguishable from inside the app.
- **Check:** cron-job.org dashboard; job history.
- **Action:** recreate the job. Consider the **second pinger** from D1's R1 mitigation.
- **Escalate:** none.

### RB6 — Mailbox account disabled
- **Symptom:** IMAP auth failures that a new app password does not fix.
- **Check:** can the mailbox be signed into manually?
- **Action:** provision a new mailbox, update `IMAP_USER`/`IMAP_PASS`, ask the user to re-point the forward. **This is the R2 scenario; there is no technical mitigation.**
- **Escalate:** Google account recovery.

### RB7 — Backup failing
- **Symptom:** no export run for more than 24 hours.
- **Check:** `job_runs` for `export`; Storage quota; credentials.
- **Action:** fix the cause, run the export manually. Then **restore from the latest export once** — an untested backup is a belief.
- **Escalate:** none.

## 7. What this deliberately does not have

No APM, no distributed tracing, no alerting service, no on-call rotation, no staging environment, no
metrics pipeline. Every one of them assumes a team or traffic that does not exist. **The
instrumentation is a database table and one page** — and it is enough for the questions that actually
get asked.
