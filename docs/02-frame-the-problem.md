# Problem brief: the scattered job search

**Stage:** 2 — Frame the problem
**Status:** ✅ approved (2026-10-20)
**Date:** 2026-10-20
**Idea (Stage 1):** *Anyone actively job-hunting — student, recent graduate, or career switcher —
struggles to know where each application stands and what is due next when the evidence is
scattered across inboxes, portals, and spreadsheets.*

---

## Who has the problem?

A person **actively running a search right now**, with roughly **10–30 live applications** over a
**3–6 month window**. Three variants, one behaviour:

- **Final-year student / new graduate** — graduate schemes and internships, batch deadlines, high
  volume, cycles measured in weeks.
- **Career switcher** — fewer applications, longer cycles, heavy networking, no fixed season.
- **International student** — the switcher's pattern plus a hard start-date constraint.

The defining trait is **volume plus consequence**, not age or status: enough applications that
memory fails, and enough at stake that a missed step is expensive. Below roughly eight live
applications, memory still works and this product has no reason to exist.

## What is the problem?

They cannot say **where each application stands** or **what they owe next** without rebuilding it
from their inbox, a portal, and a half-updated spreadsheet — and rebuilding it is exactly the
moment they stop.

Two pains hide in that sentence and must not be conflated:

| Pain | What it is | Why it matters |
|---|---|---|
| **Recall** | State has to be reconstructed from fragments | Costs time; makes the search feel out of control |
| **Drop** | A deadline, interview or follow-up passes unnoticed | Irreversible; this is the story they tell a friend |

Recall is the chronic ache. **Drop is the sharp edge.** A product that only fixes recall competes
with a free spreadsheet; one that fixes drop does something no incumbent does.

## When does it happen, and how often?

- **Season:** sharp peaks — graduate schemes and internships Sep–Nov and Jan–Mar. Career switchers
  are steady but lower volume. *Seasonal pain will look like a retention failure in the off-months.*
- **Status changes:** several per week during an active search — invites, rejections, scheduling,
  silence.
- **"Where do I stand?" checks:** 2–4× per week, with spikes before each new application ("have I
  already applied here?") and after each rejection ("what's still alive?").
- **The failure moment:** an email lands at 21:00. The intent to act is real. By the weekend it is
  buried. **The gap is not ignorance, it is 48 hours between knowing and doing.**

## How do they cope today?

The real competitor. Ordered roughly by prevalence.

| # | Coping | Does well | Breaks |
|---|---|---|---|
| 1 | **Email inbox as the database** | Free; already receives every update | No status field, no due dates, threads split, search-by-company only |
| 2 | **Spreadsheet** (Excel / Sheets) — the incumbent | Flexible, free, familiar, sorts and filters | Manual; stale within ~2 weeks; no reminders; versions multiply |
| 3 | **Notion / Airtable template** | Prettier; relational; some reminders | Setup and upkeep cost; blank-page problem; still no inbox link |
| 4 | **Trello / Kanban** | Visual pipeline, satisfying to drag | Cards go stale; no deadlines; a hobby, not a tool |
| 5 | **Phone notes / WhatsApp self-chat** | Fastest capture, always in hand | Unstructured; no state; unsearchable across a year |
| 6 | **Paper notebook / planner** | Low friction; students already own one | No search; no reminders; one lost book = total loss |
| 7 | **Calendar only** | The trigger, where they already look | Dates without the application behind them |
| 8 | **Employer portals + LinkedIn "My Jobs"** | Authoritative per employer | Fragmented; each knows only itself; often stale |
| 9 | **A tracker app, tried and abandoned** (Teal, Huntr, Simplify) | Proves the pain and the willingness to try | Proves switching is hard — abandoned within days |
| 10 | **Memory / doing nothing** | Zero cost; works under ~8 applications | Collapses exactly when the search gets serious |
| 11 | **A friend or adviser as external memory** | Social accountability | Not scalable; no record; not always available |

**The structural gap:** no mechanism holds both the **record** and the **trigger**.

- Email has the trigger, no record.
- Spreadsheet has the record, no trigger.
- Portals and notes have neither, globally.

That gap is the opening — not "spreadsheets are bad". The spreadsheet is free, familiar, and
already open. It wins on convenience; it loses on timing.

## What does it cost them?

| Cost | Rough size | Confidence |
|---|---|---|
| **Rebuilding status** | 5–10 min per check, 2–4×/week → ~1–2 hrs/month, plus ~5 min duplicate entry per application | Medium — verify in Stage 3 |
| **Lost opportunity** | One missed deadline or interview in a graduate scheme can cost the whole cycle — up to 12 months | Mechanism: high. Frequency: unknown |
| **Duplicate applications** | Embarrassing, occasionally disqualifying | Rare, high shame |
| **Avoidance** | The pile becomes aversive, they stop looking, it grows — the coping mechanism becomes why they disengage | High — the most underrated cost |
| **Money** | Little direct spend; some buy LinkedIn Premium or coaching | Low — not the lever |

**Cost shape:** frequent small time leaks, rare catastrophic misses, a slow emotional tax. The
catastrophic miss drives adoption. The slow tax drives retention.

## What is my success measure?

**One number, with a date:**

> **By 2027-01-15, at least 60% of the first 20 onboarded users (12 people) are still making
> status updates or checking their due list in week 4 after signup.**

This is displacement, not engagement. Someone still here in week 4 has stopped maintaining their
spreadsheet — the incumbent lost. It is behavioural, falsifiable, and needs no survey.

The date is provisional until Stage 8 sets the build calendar. The number is not.

## Assumptions to test (riskiest first)

1. **People will maintain a second system.** The spreadsheet is free, familiar, already open.
   Moving is a behaviour switch, and most job trackers die in week 2. If this is wrong, the pain
   is real but not painful *enough* — and the project should stop.
2. **The record can stay fresh without manual typing.** If every status change needs a keystroke,
   the tool decays exactly like the spreadsheet did. Needs email capture, quick capture, or import.
3. **The trigger is why people come back.** If users want only a list and ignore reminders, we have
   built a prettier spreadsheet with worse familiarity.

## What I do NOT know yet

- Whether the pain is **seasonal** — and therefore whether a week-4 measure taken in July means anything.
- The **volume distribution**: how many people run 20+ applications versus 3–5 that memory handles.
- Whether **email access** is acceptable (Gmail API vs forwarding vs paste) and trustworthy. *Stage 5 territory.*
- Whether "next action" can be **inferred** or is always user-declared.
- Whether **hiring stages are uniform enough to model** — real pipelines are fuzzy ("screen",
  "take-home", "final", "informal chat"). A model that fights reality makes users fight the tool.
- Whether one workflow genuinely serves all three variants, or they diverge early.
- Whether existing tools already satisfy enough people — and what specifically they get wrong.
- **Willingness to pay.** Students likely will not. A business-model question, not a Stage 2 blocker,
  but it decides whether this is a product or a portfolio piece.

---

## Decision log — success measure

**What the decision is:** the single number that proves the problem is solved, and the date we know it.

| Option | Strength | Weakness |
|---|---|---|
| **A. Week-4 retention / displacement** (chosen) | Tests the real switch — did the spreadsheet lose? Behavioural, not self-reported | Slow; noisy at n=20; silent on outcomes |
| B. Activation — 5 applications logged in 7 days | Fast; tests onboarding friction; unambiguous | Gameable by a good wizard; measures the start, not the habit |
| C. Self-reported "no missed deadlines this month" | Closest to the actual pain | Self-report bias; needs trust and telemetry; thin per-user signal |
| D. Time-to-answer under 1 minute | Tests the recall pain directly | Trivially achieved — a search box wins it |

**Recommendation: A**, with B tracked as a leading indicator. A is the only option that tests the
assumption the entire project rests on.
