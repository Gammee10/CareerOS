# Stage 3 — Validate before building

**Status:** ✅ approved — **GO**, with the emphasis moved to the check rather than the record (2026-10-20)
**Date:** 2026-10-20
**Output of this stage:** a go / change / stop decision.

---

## The constraint (stated honestly)

CareerOS is a **portfolio and learning project** first. External user interviews are out of
reach. Stage 3 therefore ran as a **structured self-study**, and the trade is explicit.

**We drop the demand claim. We keep the work claim.**

| This stage CAN establish                           | This stage CANNOT establish                |
| -------------------------------------------------- | ------------------------------------------ |
| The workflow is real for at least one person       | That anyone else has the same problem      |
| The messy details a survey would flatten           | Willingness to switch away from email      |
| A realistic dataset to build and test against      | Retention, market size, willingness to pay |
| Whether the author's own coping is actually broken | That the "drop" pain is common             |

**Demand remains an accepted, unvalidated risk.** Recorded so no later stage quietly assumes
validation happened.

## Method

Self-interview (10 questions) plus a recall test. Answers recorded in summary below.

---

## Findings

### Recall test (Q1) — ceiling failure

Target: five applications × four fields = 20 fields.

Actual: **the list of five could not be produced at all.** Three fragments were recalled:

- INSA — intern — "like two weeks or something" — no state
- INSA — weekend/online intern — "being analysed" — no date
- 3–5 applications from one job-posting site, "around 3 weeks, not very sure" — one of them checked

**Result: unscoreable as designed, and that is the finding.** No dates are reliable; no state is
recorded; the count itself is a floor ("at minimum 15"). Recall is not imprecise at the edges —
**there is no retrievable index**. Any answer requires a search action before an answer exists.

### Drops (Q5, Q6, Q7) — real and recent

- **One missed interview.**
- **One missed exam/assessment**, roughly one week before this interview.
- At least one deadline that passed after the update was _seen_ and consciously deferred:
  "I saw the email and said I'll apply/check later, and the deadline passed."

The mechanism is **deferral, not ignorance**. This directly confirms Stage 2's "48 hours between
knowing and doing".

### Coping (Q2, Q8, Q9) — the incumbent is not a spreadsheet

- Sources named: **memory, email, employer sites.** Nothing else.
- **No tracker app has ever been tried** (Q8).
- A spreadsheet is not in use, and was judged explicitly: _"a spreadsheet has no reminder, it is
  not much different from checking my email, only organised."_

**Correction to Stage 2:** for the author, the competitor is **email + memory**. The spreadsheet
is not the incumbent; it is a rejected alternative. "Organised email" is the bar, and the user does
not believe a spreadsheet clears it.

### Felt pain (Q10)

> "Searching through applied jobs is boring — like very much — and painful."

Retrieval is **aversive**, not merely slow.

---

## The revised pain model

Stage 2 modelled Recall and Drop as two parallel pains. The evidence says they are **one chain**:

> **Retrieval costs too much → so it is avoided → so updates go unseen → so dates are missed.**

The missed interview is downstream of "checking is painful". This matters because it moves the
product's centre of gravity: the job is not _storing_ applications, it is **making the check
nearly free and putting it where the user already is.**

---

## Decision (adapted for n=1)

| Outcome    | Evidence for                                                                                                                      | Evidence against                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **GO**     | Recall failed outright; two real drops in ~3 months, one within a week; record spread across memory, email and employer sites     | n=1, self-reported, no external demand evidence                                         |
| **CHANGE** | The pain is real but narrow — it is the _check_, not the _record_. Pipeline stages and analytics are unsupported by this evidence | The author does want a record of what was applied to ("searching through applied jobs") |
| **STOP**   | —                                                                                                                                 | Nothing supports this: the pain is the author's, and it cost them an interview          |

**Decision: GO**, with a **change of emphasis**.

GO is justified on the work claim, not the demand claim: the workflow is real, the losses are
real, and the shape of the problem is now known. Demand stays an open risk, tested by week-4
retention after the build.

## Corrections carried forward

1. **The incumbent is email + memory**, not a spreadsheet. Switching cost is lower than feared,
   but so is the bar — we must beat "organised email".
2. **No tracker app has been tried**, so "people are tired of trackers" is not evidence we have;
   it is an assumption we imported.
3. **Dates cannot be assumed.** The author cannot recall when they applied to a minimum of 15
   applications. Any mandatory date field will be skipped or invented.
4. **The pain is one chain, not two:** retrieval cost → avoidance → misses.

## Design implications (for Stages 4 and 6, not decided here)

- The check must cost **seconds**, and must arrive **where they already are** (email or phone
  notification) — a dashboard that must be remembered will lose to the inbox it is meant to beat.
- **Dates must be optional and approximate.** "Around two weeks ago" has to be an acceptable input.
- **"What do I owe next" must be answerable without searching.** If the user has to look something
  up, we have rebuilt email.

## Revised risk register

| Risk                                          | Status after Stage 3                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R1 — People will not maintain a second system | **Untested.** Still the top risk.                                                                          |
| R2 — The record decays without manual typing  | **Raised to urgent.** The author could not recall enough to type. Capture must be automatic or near-free.  |
| R3 — The trigger is why people return         | **Strengthened.** Every reported loss came from a missed trigger.                                          |
| R4 — Demand                                   | **Untested.** Accepted risk, decided knowingly.                                                            |
| R5 — Hiring stages are modelable              | **Untested.** No consistent stage vocabulary observed.                                                     |
| R6 — Attention competition                    | **New.** The author is a student sitting exams. The product competes with coursework, not just other apps. |

## What I do NOT know yet

- Whether the missed "exam" was a university exam or a scheduled assessment for an application.
- The day-by-day account of the last 7 days (Q3 skipped).
- When the tracker was last consciously updated (Q7 skipped).
- Whether the 3–5 job-site entries were genuine applications or clicks into an application flow.
