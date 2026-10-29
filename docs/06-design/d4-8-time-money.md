# D4.8 — Time and money

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-24
**Scope:** how every date, deadline and duration is stored, computed and displayed — and the rules for
money, which v1 does not have but must not get wrong later.

## 1. The rules

1. **Store instants in UTC** (`timestamptz`). Never store a UTC offset.
2. **Store the timezone as an IANA name** (`Africa/Nairobi`) on the profile, never as `+03:00`.
3. **Convert at the edges** — at display, and at the moment a schedule decision is made.
4. **Never do date arithmetic on local strings.** Parse to an instant, do the maths, format back.
5. **ISO weeks for anything weekly** — the digest key is `(iso_year, iso_week)`.

These are the rules Spike 4 measured the cost of ignoring: a fixed-offset scheduler fires at the
wrong local time in 26–34 weeks a year.

## 2. The decision: two kinds of time, not one

Most application deadlines are **dates**, not instants. "Apply by 30 October" has no time, and
inventing one (`00:00` or `23:59`) is a guess that shows up as an off-by-one-day bug.

| Option                                                                                   | Strength                                                                                          | Weakness                                                                     |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **A. Two columns: `due_date` (date) + `due_at` (timestamptz), exactly one set** (chosen) | Each fact is stored as what it actually is; no invented times; a check constraint keeps it honest | Every query must handle both; sorting needs a computed instant               |
| B. One `timestamptz`, assume local midnight                                              | One column, simple sorts                                                                          | Midnight is a lie for a deadline — is it the start or the end of that day?   |
| C. One `timestamptz` plus an `all_day` flag                                              | One column, flexible                                                                              | The flag and the time can disagree; two sources for one fact (violates D4.4) |

**Recommendation: A.**

```sql
-- in due_items, replacing the single due_at column from D4.1
due_date date,
due_at   timestamptz,
constraint due_items_one_time check (num_nonnulls(due_date, due_at) = 1)
```

**Display and sort rule:** a `due_date` renders as a date ("30 Oct"); a `due_at` renders with the
time. To sort or compare, compute an effective instant in the user's zone — start of day for a date —
but **never store that computed value**.

**Why this is the right call for this product:** Spike 1 found that 11 of 15 real emails carried no
date at all, and Spike 3 found dates arriving as "like two weeks or something". Precision is low, so
the schema should not claim more than the source has.

## 3. Durations and periods

| Concept                  | Rule                                                                         | Example                                                   |
| ------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| "Quiet for 10 days"      | **240 hours of UTC**, not 10 local calendar days                             | avoids skipping or double-counting across a DST shift     |
| "Due in the next 7 days" | The 7-day window is computed once, from `now` in UTC, then displayed locally | —                                                         |
| Digest week              | ISO week of the **user's local date**, not UTC                               | a Sunday-evening UTC instant is already Monday in Nairobi |
| "This week" on screen    | Same ISO week as the digest                                                  | the digest and the screen never disagree                  |

The digest-week rule matters more than it looks: if the key were computed from UTC, a user east of
UTC would occasionally get two digests or none. Spike 4's "exactly one per week" is only true if the
week is defined in the user's zone.

## 4. Dates arriving from email

An email may say "August 26", "26/08/2026", or "next Thursday". The parser must not guess:

| Input                                          | Handling                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Unambiguous (`26 Aug 2026`, `August 26, 2026`) | Accept                                                               |
| Ambiguous (`26/08/2026`, `08/26/2026`)         | **Assume nothing** — accept with low confidence, route to Review     |
| Relative (`next Thursday`, `in two weeks`)     | Do not resolve automatically; store the phrase, route to Review      |
| No date                                        | `due_date` and `due_at` both null — a legitimate state, not an error |

**A wrong deadline is worse than a missing one.** A missing date leaves the item in "no date" and you
can add it; a wrong date puts a real interview on the wrong day. This is the same rule as the parser's
overall design, applied to the most dangerous field.

## 5. Display

- Instants render in `profiles.timezone`, with the zone abbreviation when it is ambiguous.
- Relative labels ("in 3 days", "overdue by 2") are computed at render, never stored (D4.4).
- The due list groups by local day, not UTC day.
- A date-only item never shows a time, and a timed item never shows a bare date.

## 6. Money

**v1 has no money.** No payments, no salaries, no budgeting feature. The only money in the system is
whatever a salary figure in an email happens to say, and that is never parsed or stored as a number —
it lives in the raw body for 7 days and disappears.

**If money is ever added, the rules are already fixed:**

1. Store **integers in the smallest unit** (cents), never floats.
2. Store the **currency code** beside the amount; never assume one.
3. Never do arithmetic across currencies without an explicit rate and timestamp.
4. Never derive totals that are stored — compute them (D4.4).

Writing this now costs four lines and prevents the class of bug that costs a financial product its
credibility.

## 7. Tests that must exist (Stage 10)

| Test                                                                      | Why                                    |
| ------------------------------------------------------------------------- | -------------------------------------- |
| Digest fires exactly once across a DST transition                         | Spike 4 property, now enforced in code |
| A `due_date` today shows as "today", not "yesterday", for a user at UTC+3 | The classic off-by-one                 |
| ISO week computed from local date, not UTC                                | The two-digests-or-none bug            |
| 10-day silence across a DST shift is still 240 hours                      | Duration vs calendar confusion         |
| Ambiguous `26/08/2026` goes to Review, never auto-filed                   | The most damaging parser error         |

## 8. D4 is complete

Eight pieces done. What follows is D5 (interfaces and how they change), D6 (how it runs and is
observed), D7 (what could be wrong), D8 (how it does not rot).
