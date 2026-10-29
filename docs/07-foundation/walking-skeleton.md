# Step 7 — The walking skeleton

**Status:** ✅ live — <https://career-os-green-two.vercel.app>
**Date:** 2026-10-30

## What exists

One page, one API route, one database query. Nothing else.

```
browser  →  GET /                     (Next.js page, client fetch)
         →  GET /api/health           (route handler, force-dynamic)
         →  select now(), current_database()   (Postgres via postgres.js)
```

The page renders the **database's own clock**, not the web server's. That is the whole trick: if the
value came from Postgres, the path is real.

```json
{
  "ok": true,
  "database": "postgres",
  "databaseTime": "2026-10-29T22:38:36.486Z",
  "checkedAt": "2026-10-29T22:38:36.522Z",
  "commit": "806eb32dee9e20dd6dc2164836a4bf39ce190d80"
}
```

The 36 ms gap between `databaseTime` and `checkedAt` is the round trip to Supabase. The `commit`
field is what makes the deploy path verifiable from the outside.

## Each connection, and its evidence

| #   | Connection       | Evidence                                                                                                          |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Page → API       | The page's HTML contains the loading state, never the data; the value appears only after the fetch                |
| 2   | API → database   | `databaseTime` is Postgres's clock, ~36 ms behind `checkedAt` (the web server's clock at response time)           |
| 3   | Code → CI        | Pull requests #2 and #3 both show `verify` green (typecheck, lint, format, 18 tests, `next build`) before merging |
| 4   | CI → deploy      | Merge `806eb32` → the live endpoint reports `commit: 806eb32…` without any manual step                            |
| 5   | Deploy → secrets | The repository contains no connection string; the deployed route reads `DATABASE_URL` from Vercel's environment   |
| 6   | Failure path     | Unit tests pin the 503 payload; the page renders the API's message instead of a blank screen                      |

## What it cost, and what it did not include

- **No schema, no migrations, no auth, no styling system.** The query is `select now()` — one row,
  zero tables.
- **No secrets at build time.** The Postgres client is created lazily, so `next build` runs without
  `DATABASE_URL`; CI proves this on every pull request.
- Two dependencies added: `postgres` (client) and the Next/React stack.

## Deliberate deviations, recorded

| Decision  | Deviation                                        | Why                                                                                                                             |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| ADR 0003  | Next.js **16**, not the recorded 15              | 15 is no longer current; starting on an older major on purpose is worse. Amended in the ADR                                     |
| Design D2 | `/api/health` exists only as a skeleton endpoint | It stays: a health endpoint that reports uptime, database reachability and deployed commit is a permanent operational need (D6) |

## What this unlocks

Every later feature repeats this shape: page → module door → database, merged through CI, deployed
automatically. The remaining work is features, not plumbing.

## Known limitations of this step

- Cold start on the first request after idle: ~2.4 s for `/api/health`, then ~0.3 s.
- No observability beyond the endpoint itself; structured logs and the freshness panel arrive with
  the ingest work.
- The page is intentionally unstyled — Tailwind and components arrive with the first real screen.
