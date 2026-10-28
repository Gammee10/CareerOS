# Spike 4 — Will the digest fire, once, at the right local time, on a free host?

**IDs:** U5, U6
**Box:** half a day
**Status:** 🟡 plan drafted, awaiting go-ahead
**Date:** 2026-10-22

## The question, in plain words

Two questions that look unrelated but share one cause:

1. **The clock.** Can we make "Monday 08:00 in the user's timezone" fire **exactly once** — never
   twice, never skipped — including in the two weeks a year when clocks move?
2. **The host.** Will a free hosting tier actually run that code at that moment, without having
   gone to sleep?

## Why it matters

- A digest that fires **twice** is spam, and it is the fastest way to lose the one channel that
  brings the user back.
- A digest that fires **never** is the product quietly dying — and silence looks identical to
  "nothing to report", which is the worst possible failure mode for a reminder product.
- A host that **sleeps** delays the ingest poller. If the poller wakes every 15 minutes instead of
  60 seconds, the spec's `< 2 min p95` is dead before the first user.

## What can actually be tested today

### Part A — the clock (fully testable, no accounts, no cost)

A simulation over a full year, minute by minute, using a real IANA timezone database:

| Timezone | Why it is in the set |
|---|---|
| `Africa/Nairobi` | The actual user — no DST, the baseline |
| `Europe/London` | Northern DST, Sunday 01:00 shift |
| `America/New_York` | DST at a different date than London |
| `Australia/Sydney` | Southern hemisphere — DST in the opposite season |
| `Australia/Lord_Howe` | **30-minute** DST shift, the nastiest case in the database |

For each zone: count fires, assert **exactly one per ISO week**, at **08:00 local**, never zero,
never two. Roughly 5 × 52 weeks of simulated minutes.

Also tested: **catch-up policy.** If the process is down at 08:00 and starts at 08:05, what happens?
A reminder product must pick one — fire late with a marker, or skip — and must do it
deterministically. Both options get simulated.

### Part B — the host (needs an account, cannot be faked)

Free-tier scheduling is where the marketing and the reality diverge:

| Option | Documented free behaviour | Risk |
|---|---|---|
| **Cloudflare Workers cron** | Every minute, free plan, no sleeping | Node-incompatible runtime; IMAP from Workers is painful |
| **GitHub Actions cron** | Every 5 min minimum, free for public repos | Delays of 5–20 min under load; **disabled after 60 days of repo inactivity** |
| **Render free web service** | Sleeps after 15 min idle | Ingest poller would break the latency target |
| **Railway / Fly** | Trial credit, then paid | Not "free" beyond a trial |

**Part B needs the user to create a free account**, because nothing can be deployed without
credentials. If that is not wanted tonight, the honest outcome is to record the documented limits,
pick a candidate, and verify it in Stage 7 when the repo exists — flagged as a known unknown rather
than silently assumed.

## Decision thresholds

| Result | Decision |
|---|---|
| Part A passes in all five zones | Scheduler design is settled; the timezone test becomes a permanent unit test |
| Part A fails anywhere | Do not build the digest until the scheduling model is redesigned |
| Part B untested | Record documented limits, choose the least-risky option, and put a hard check in the Stage 7 walking skeleton: **the first deploy must prove a scheduled run actually fires** |

## Roles

| Who | Does |
|---|---|
| **Me** | Write and run the year-long simulation, report fires per zone, test the catch-up policy, delete the throwaway code |
| **User** | Decide whether Part B happens now (requires a free account) or is deferred to Stage 7 |

## What this spike will not prove

It will not prove that Cloudflare/GitHub/Render's free tier is reliable in practice — only what
their documentation claims. Reliability of a free host is learned by running on it, not by reading.

## Part A result — PASS in all five zones

Minute-by-minute simulation of the whole of 2027 (52 Mondays), five timezones.

### 1. Healthy process — exactly once per week

| Zone | Weeks | Fires | Fired twice | Missed | Fired late |
|---|---|---|---|---|---|
| Africa/Nairobi | 52 | **52** | 0 | 0 | 0 |
| Europe/London | 52 | **52** | 0 | 0 | 0 |
| America/New_York | 52 | **52** | 0 | 0 | 0 |
| Australia/Sydney | 52 | **52** | 0 | 0 | 0 |
| Australia/Lord_Howe | 52 | **52** | 0 | 0 | 0 |

Computing the target from local time on every tick is correct through DST, including the 30-minute
Lord Howe shift.

### 2. Asleep at 08:00 — strict loses the week, catch-up does not

Outage 07:55–08:10 on three weeks:

| Policy | Fires | Weeks missed |
|---|---|---|
| Strict (only at exactly 08:00) | 49 | **3** |
| Catch-up (within 6 h after 08:00) | 52 | 0 |

A free host *will* be asleep or restarting sometimes. Strict scheduling therefore guarantees lost
digests — and a lost digest is indistinguishable from "nothing to report".

### 3. Crash right after sending — 357 duplicate emails without a durable record

Process dies 30 seconds after sending, restarts at 08:05:

| State | Fires that week |
|---|---|
| Durable "already sent" record | **1** |
| In-memory flag only | **357** |

The catch-up window retries every minute, so a lost in-memory flag re-sends on every remaining tick.
**Requirement: an idempotency key on `(user_id, iso_week)` in the database**, not a variable in
memory. This is the single most important finding of the spike.

### 4. The tempting shortcut is badly wrong

Schedulers commonly store the UTC offset once at setup. How many weeks would that fire at the wrong
local time?

| Zone | Fixed offset | Weeks at the wrong local time |
|---|---|---|
| Africa/Nairobi | +03:00 | 0 |
| Europe/London | +00:00 | **31** |
| America/New_York | −05:00 | **34** |
| Australia/Sydney | +11:00 | **26** |
| Australia/Lord_Howe | +11:00 | **26** |

### Design rules this fixes for Stage 6

1. Compute the fire decision from **local time on every tick**; never persist an offset.
2. Use a **catch-up window** (6 h), not an exact instant.
3. Persist **one digest per `(user, ISO week)`** with a unique constraint.
4. Store the timezone as an IANA name, not an offset.

## Part B — documented limits (deferred to Stage 7 by agreement)

The user chose not to create an account tonight. What the documentation says:

| Option | Free behaviour | Fit for this product |
|---|---|---|
| Cloudflare Workers cron | Every minute, no sleeping | Runtime cannot do IMAP; would force an HTTP mail API |
| GitHub Actions cron | 5-minute minimum, delayed under load, **disabled after 60 days of inactivity** | Can run IMAP code; ingest latency 5–10 min |
| Render free web service | Sleeps after 15 min idle | Breaks a 60-second poller |
| Railway / Fly | Trial credit, then paid (~$5/month) | The only always-on option considered |

**Finding:** there is **no free tier that gives an always-on process at 60-second granularity.**
The architecture decided in ADR 0001 (an IMAP poller) needs one, so the realistic choices are
GitHub Actions at 5-minute granularity (and accepting 5–10 min ingest latency), or roughly
**$5/month** for an always-on host — inside the `< $10/month` budget, outside "free".

That is a Step 3 (build/buy/borrow) decision, not a spike result. It is recorded here so it cannot be
forgotten.

**Stage 7 requirement:** the walking skeleton must prove a scheduled run actually fired. Documentation
is not evidence.

