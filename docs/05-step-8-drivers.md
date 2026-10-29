# Stage 5 · Step 8 — Architecture drivers

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-22
**Purpose:** the facts that shape the design. A design is good when it meets these at the lowest
cost, and trade-offs cannot be argued until they are written down.

---

## 1. Quality targets

Each is a scenario with a number and a way to measure it. "Fast" and "reliable" are not targets.

| #   | Quality              | Scenario                                             | Target                                                   | Measured by                                |
| --- | -------------------- | ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Q1  | Speed — app          | User opens the due list on a mid-range phone over 4G | **LCP < 1.5 s p95**; API < 500 ms p95                    | Vercel analytics + server timing           |
| Q2  | Speed — ingest       | An application email lands in the mailbox            | **Visible in the app < 6 min p95**                       | Mailbox `Date` → `applications.created_at` |
| Q3  | Speed — actions      | User marks an item done or snoozes                   | UI updates instantly; **server confirms < 300 ms p95**   | Optimistic UI + server timing              |
| Q4  | Correctness — parse  | An email is filed without human review               | **≤ 2% wrong company or role; ≤ 1% wrong stage**         | Weekly sample audit of filed rows          |
| Q5  | Correctness — recall | An email cannot be parsed                            | **Goes to Review; never guessed**                        | Review queue count vs ingested count       |
| Q6  | Correctness — digest | Monday arrives                                       | **Exactly 1 per user per ISO week; 0 duplicates, ever**  | Unique key `(user_id, iso_week)`           |
| Q7  | Correctness — queue  | Any inbound email                                    | **0 lost, 0 duplicate applications**                     | `inbound` vs `applications` reconciliation |
| Q8  | Freshness            | Ingestion is running                                 | **Last successful ingest < 30 min old, 99% of the time** | Heartbeat row + UI banner                  |
| Q9  | Security             | A user requests another user's data                  | **403, 100% of the time, and logged**                    | RLS test in CI                             |
| Q10 | Privacy              | A raw email is 7 days old                            | **Body deleted within 24 h of the mark**                 | Retention job log                          |
| Q11 | Availability         | The web app                                          | **99% monthly, best effort**                             | Uptime checks                              |
| Q12 | Recoverability       | The database is lost                                 | **RTO 4 h** from repo + Gmail                            | Rehearsal once, in Stage 10                |
| Q13 | Cost                 | Steady state                                         | **$0 at ≤ 10 users; ≤ $25/month at 100**                 | Billing dashboards                         |
| Q14 | Changeability        | A new sender format appears                          | **≤ 1 day** to add rules + tests                         | Time from first Review failure to fix      |
| Q15 | Changeability        | A new page or view                                   | **≤ 1 day**, no schema change                            | —                                          |

### The two targets with no comfortable answer

**Q12 — recoverability is asymmetric.** Structured data is rebuildable from Gmail, so the loss of the
_database_ is survivable. The loss of **edits, snoozes and dismissals** is not: they exist only in
Postgres, and the free tier has no backups. Honest statement: **RPO is effectively zero for anything
the user typed.** Mitigation for Stage 6: a nightly logical export to Supabase Storage with 7-day
rotation — inside the free 1 GB — accepting that it does not survive losing Supabase itself.

**Q8 — freshness is the real availability target.** "Is the site up?" matters less than "is the data
current?". A working page showing week-old data is worse than an error page, because it looks
correct. The freshness banner is therefore a feature, not a nicety.

---

## 2. Constraints

| Kind            | Constraint                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Team            | **One part-time builder**, plus an agent. No second pair of eyes.                                    |
| Budget          | **$0/month.** No domain. Vercel Hobby (non-commercial), Supabase Free, Gmail.                        |
| Timeline        | No external deadline. Internal target: **walking skeleton live within 2 weeks** of Stage 7 starting. |
| Platform        | Responsive web, 360 px minimum. English only. No native app.                                         |
| Dependencies    | **No LLM.** No managed queue. No paid third party.                                                   |
| Legal / privacy | Personal, non-commercial. Raw email 7 days, snippets 30 days.                                        |
| Trust           | The system reads the owner's mailbox. Any change to that scope is a decision, not a commit.          |

---

## 3. Scale numbers (back of envelope)

Round numbers, with the 10× column the guide asks for.

| Dimension                         | v1         | 10×        | Notes                                        |
| --------------------------------- | ---------- | ---------- | -------------------------------------------- |
| Users                             | 1          | 10         |                                              |
| Applications / user / year        | 50         | 50         |                                              |
| `applications` rows / year        | 50         | 500        |                                              |
| `events` rows / year (≈5 per app) | 250        | 2 500      |                                              |
| Inbound emails / month            | 30         | 300        |                                              |
| **Ingest runs / month**           | **8 760**  | **8 760**  | **constant — one mailbox, not one per user** |
| Digest emails / month             | 4          | 40         |                                              |
| DB size / year                    | **< 5 MB** | **~30 MB** | 500 MB free limit                            |
| Peak page views / day             | 20         | 200        |                                              |
| Peak concurrent users             | 1          | 3          |                                              |
| Requests / second (peak)          | < 0.1      | < 1        | the pinger is the busiest caller             |

**The shape that matters:** compute does not scale with users, because polling is per mailbox. What
grows is rows, digests, and the chance of hitting a contractual ceiling (Vercel Hobby's
non-commercial term) long before a technical one.

---

## 4. Top risks

| #   | Risk                            | Impact                        | Mitigation                                             | Residual                            |
| --- | ------------------------------- | ----------------------------- | ------------------------------------------------------ | ----------------------------------- |
| R1  | **The pinger dies silently**    | Data goes stale with no error | Freshness banner (Q8); daily self-check                | Medium — nothing external alerts us |
| R2  | **Google disables the mailbox** | Ingestion _and_ digests stop  | None available; source email survives                  | **High — accepted**                 |
| R3  | **Parser mis-files**            | Wrong data, trust lost        | Review queue; 2% target; audit                         | Low–medium                          |
| R4  | **No backups**                  | User edits unrecoverable      | Nightly export to Supabase Storage                     | Medium                              |
| R5  | **Free-tier terms change**      | Forced migration or shutdown  | Exit plans in ADR 0001/0002                            | Medium                              |
| R6  | **Solo builder abandonment**    | Project never ships           | Walking skeleton first; vertical slices; 2-week cycles | **High — the real risk**            |

R6 is listed last and matters most. A portfolio project does not usually fail on architecture; it
fails on the third weekend.

---

## What Stage 6 must now answer

Everything above is a target. Stage 6 decides the shape that meets them:

1. What are the modules and their boundaries?
2. What is the data model — tables, keys, invariants?
3. What are the interfaces between modules, and their failure behaviour?
4. Where does the system degrade, and what does the user see when it does?
