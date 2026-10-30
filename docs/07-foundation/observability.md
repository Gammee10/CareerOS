# Observability baseline

**Status:** ✅ live · 2026-10-30
**Scope:** step 8 of the foundation. What we watch, how we find out, and what we have chosen not to
have yet.

## The one outside observer

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| **What**      | UptimeRobot, free plan                                        |
| **URL**       | `https://career-os-green-two.vercel.app/api/health`           |
| **Interval**  | 5 minutes                                                     |
| **Condition** | HTTP **200** _and_ the response body contains **`"ok":true`** |
| **Alert**     | email to the owner                                            |
| **Status**    | UP                                                            |

### Why the keyword and not just the status code

A plain "did it return 200?" check has a failure mode we have already hit once: **Vercel's SSO
protection page returns HTTP 200** while serving a login screen instead of the app. An endpoint can
also return 200 with `{"ok":false}`. Matching `"ok":true` means the monitor is asserting that _the
database answered_, not merely that a server is listening.

`/api/health` is therefore not a generic ping — it is the check that the whole path
(browser-facing server → Postgres) is alive.

### The alert was proven, not assumed

1. The monitor was first pointed at `…/api/health-nope` — a URL that cannot succeed.
2. The **down** email arrived.
3. The URL was corrected to `…/api/health`.
4. The dashboard shows **UP**.

An alert nobody has received is a belief. This one has been received.

## What the app guarantees on failure

| Situation                | Response                                                                | Log                                                         |
| ------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| Database reachable       | `200` `{ ok: true, database, databaseTime, checkedAt, commit }`         | none (success is silent)                                    |
| Database unreachable     | **`503`** with `{ error: { code: "dependency_unavailable", message } }` | **one** JSON line: `level`, `event`, `code`, redacted cause |
| Database returns no rows | `500` with `{ error: { code: "internal" } }`                            | one JSON line                                               |

Both paths are covered by tests, including one that puts a connection string with a password inside
the simulated driver error and asserts the secret appears in **neither** the response body nor the
log line.

## Questions we can answer today

| Question                                     | How                                            |
| -------------------------------------------- | ---------------------------------------------- |
| Is the site up?                              | UptimeRobot dashboard; email on failure        |
| Is the database reachable?                   | Same check — the endpoint asks the database    |
| Which commit is running?                     | `commit` field in `/api/health`                |
| What failed and when, in the last few hours? | Vercel runtime logs (JSON lines from `log.ts`) |

## What we deliberately do not have yet

| Gap                                    | Consequence                                                             | When it closes                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **No durable error store**             | An exception at 3 a.m. is visible only until Vercel's log window closes | The `job_runs` table (D6), with the ingest feature                             |
| **5-minute detection**                 | Up to 5 minutes of outage before the first alert                        | Not planned; smaller is not worth the cost                                     |
| **No error-tracking service**          | No grouping, no stack traces, no "new error" alerts                     | Deliberate: Step 3 recorded "logs first, add Sentry when there is a real user" |
| **No metrics or dashboards**           | No trends, only point-in-time                                           | Deliberate (D6: a metrics pipeline for one user is a toy)                      |
| **The monitor is a third party**       | It could stop without telling us                                        | Monthly check: confirm the dashboard still reports UP                          |
| **Alerts depend on one email address** | Spam filters, a full inbox, or an abandoned address                     | Add the sender to contacts; keep the address active                            |

## What to do when the alert arrives

1. Open `/api/health` yourself. A **503** means the app is fine and the database is not — check the
   Supabase dashboard (paused project, exceeded quota).
2. A **timeout** or connection error means Vercel is unhealthy — check the Vercel deployment list for
   a failed build or an outage.
3. A **200 with the wrong keyword** means something is serving HTML (usually Vercel deployment
   protection re-enabled) — the app is not reachable.
4. If the site is up but stale, that is a different failure: ingestion, not uptime. It arrives with
   the freshness banner (D1.6) and is not covered by this monitor.

Step 9 turns this list into files in `docs/runbooks/`.
