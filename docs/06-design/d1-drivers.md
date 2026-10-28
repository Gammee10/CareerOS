# D1 — Drivers: what must be true?

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-23
**Full driver sheet:** [05-step-8-drivers.md](../05-step-8-drivers.md) — 15 numbered targets with
measurement methods.

## Why this document is shorter than that one

The Stage 5 sheet lists **everything that must be true**. Design does not need everything — it needs
the handful of targets that actually bend the shape. Seventeen targets create seventeen arguments;
seven create a design.

So D1 is a **reduction**, not a rewrite. The other eight targets stay alive as acceptance criteria in
Stage 10; they simply do not get a vote on architecture.

---

## 1. The seven scenarios that shape the design

| ID | Scenario | Target | Test | What it forces |
|---|---|---|---|---|
| **D1.1** | An application email arrives in the mailbox | Visible in the app **< 6 min p95** | Mailbox `Date` → `applications.created_at` | Serverless trigger, a durable queue, no always-on worker |
| **D1.2** | Monday 08:00 local arrives | **Exactly 1 digest per user per ISO week** | Unique key `(user_id, iso_week)` | Idempotency in the database, not in memory |
| **D1.3** | The same email arrives twice, or two workers race | **0 duplicate applications, 0 lost emails** | Unique `message_id` + `SKIP LOCKED` replay test | Unique constraints and one queue table |
| **D1.4** | The user opens the app | Due list **LCP < 1.5 s p95** | Field measurement, mid-range phone | One indexed query per screen; no client-side joins |
| **D1.5** | An email cannot be parsed confidently | **≤ 2% wrong** company/role in filed rows | Weekly audit of 20 filed applications | A Review queue as a first-class screen, not an error path |
| **D1.6** | Ingestion is silently broken | **Visible as stale within 30 min** | Heartbeat row + banner | A freshness surface in the UI |
| **D1.7** | The bill arrives | **$0 at ≤ 10 users** | Billing dashboards | Serverless, one region, no managed queue, no LLM |

Everything else — page-level timings, action latency, security, privacy retention, availability,
changeability — is a **feature-level acceptance criterion**, tested in Stage 10, not a design driver.

---

## 2. Where targets fight, and who wins

This is the part that prevents taste arguments later. Each row is a real collision we will hit.

| Fight | Why it is real | **Winner** | What we give up |
|---|---|---|---|
| **Cost vs latency** | A paid always-on host would make ingest 60 s instead of 5 min | **Cost** | Ingest is 5 minutes, not 30 seconds. Invisible in use, but real |
| **Completeness vs correctness** | Filing every email automatically feels better than queuing some | **Correctness** | Some emails sit in Review. A blank field is better than a plausible wrong one — Stage 1's whole thesis |
| **Simplicity vs flexibility** | Microservices would let the parser scale separately | **Simplicity** | One deployable. If the parser ever needs its own scaling, the module boundary is where we cut |
| **Privacy vs convenience** | An LLM would parse unknown formats better than rules | **Privacy** | We accept a lower recall ceiling and a Review queue, so other people's email never leaves the system |
| **Notifications vs peace** | Repeated reminders would "work" in engagement terms | **Peace** | One prompt per application, dismissible. A nagging product gets muted, and a muted product is dead |
| **Feature breadth vs reliability** | More features would look better in a portfolio | **Reliability** | The scope stays at seven Must stories |

**The general rule:** when a target conflicts with trust, trust wins. Every one of the losing
options above buys something the user would notice only once, at the cost of something they would
notice every week.

---

## 3. Back-of-envelope, three lines

1. **Throughput:** 8 760 ingest runs/month ≈ **0.003 req/s** average; peak **1** concurrent run;
   10× = 0.03 req/s and still 1 concurrent. *Nothing here is a scaling problem.*
2. **Data:** 50 applications × 2 KB + 250 events × 0.3 KB ≈ **0.1 MB/user/year**; with live raw
   emails (7-day window) ~1–2 MB total. 10× = **~30 MB/year** against a 500 MB limit.
3. **Cost:** **$0 fixed** at ≤ 10 users; at 100 users ≈ $21/month ≈ **$0.21/user**. Marginal cost per
   extra user is a rounding error until a contractual ceiling, not a technical one.

**Peak-to-average:** the only bursty moment is *the Monday digest*, 4 sends per month, which is not a
burst. There is no traffic spike to design for. That is worth stating plainly, because most
architecture advice assumes one.

---

## 4. Assumptions we will measure later

| # | Assumption | Measured by | When |
|---|---|---|---|
| A1 | A user forwards ~30 emails/month | `inbound` row count per month | Month 1 |
| A2 | The parser stays under 2% wrong on *real* mail (it is untested on real rejections/interviews) | Weekly 20-row audit | Weekly from launch |
| A3 | The external pinger fires reliably enough | Gap between expected and actual ingest runs | Daily check |
| A4 | The user opens the app at least twice a week, so the digest matters | Page views per week | Month 1 |
| A5 | Forwarding setup completes without help | Time-to-first-application | First 5 users |

A2 is the one most likely to be wrong: Spike 3 measured acknowledgements only, and acknowledgements
are the easy case.

---

## 5. Top five architecture risks — and what we do about each

A risk without a response is decoration. Each row names the response, **where it will be designed**,
and whether it is settled or still open.

| # | Risk | Response | Owned by | Status |
|---|---|---|---|---|
| **R1** | **The pinger dies silently** — data goes stale and looks like a calm week | (a) Every ingest run writes a **heartbeat row**; (b) the UI shows a **stale banner** after 30 min; (c) a **second, independent scheduler** hits the same endpoint — safe because ingestion is idempotent per message, so two pingers cost one wasted run, not duplicate data; (d) a daily check compares expected vs actual runs | D5 (interfaces), D6 (operate) | To design |
| **R2** | **Google closes the mailbox** — ingestion and delivery stop together | **No technical mitigation exists.** The response is recovery: provision a new mailbox, update one environment variable, re-point the user's forward. Source emails survive in the user's own Gmail, so the *data* is recoverable even when the account is not. Written as a **runbook**, rehearsed once | D6 (runbook), Stage 10 | Accepted |
| **R3** | **Parser mis-files** — a plausible wrong company is worse than a blank | (a) **Review queue** for anything below confidence; (b) weekly 20-row **audit** (A2); (c) a **golden corpus** of real emails as regression tests — every new format becomes a test case; (d) low confidence never auto-files | D4 (invariants), D5, Stage 10 | Partly built (Spike 3 rules) |
| **R4** | **No backups on the free tier** — edits and snoozes are unrecoverable | **Nightly logical export** of applications + events + snoozes to Supabase Storage, 7-day rotation, inside the free 1 GB. A restore is **rehearsed once**; a backup nobody has restored is a belief, not a backup. Does not survive losing Supabase itself | D4 (life cycle), D6, Stage 10 | To design |
| **R5** | **The build never finishes** — the most likely failure of all | (a) **Walking skeleton** live before features (Stage 7); (b) **seven stories only**; (c) vertical slices with a time box — a slice that overruns gets cut, not extended; (d) a demo at the end of every slice | Stages 7–9 (process) | Process, not design |

**Two of these cannot be mitigated, only survived** — R2 and R4. Saying that plainly is more useful
than inventing a control that does not exist. The other three have real responses that D2–D6 must
actually build.


---

## 6. What D1 adds that Stage 5 did not have

1. **A reduction rule** — seven design drivers, not fifteen.
2. **Explicit conflict resolutions** — cost beats latency, correctness beats completeness, privacy
   beats convenience, peace beats engagement.
3. **A "what we give up" column** — every winner has a cost, written down.

Design decisions in D2–D8 will be judged against these seven, and against nothing else.
