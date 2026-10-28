# ADR 0006 — The digest is idempotent, late-tolerant, and computed in local time

**Status:** Accepted — 2026-10-22
**Evidence:** Spike 4 (52/52 weeks in five timezones, 0 doubles)
**Related:** Stage 4 S7, Stage 5 Step 3 (serverless)

## Context

The Monday digest is a Must story, and it is the channel that brings the user back. Three ways to
get it wrong: fire twice, never fire, or fire at the wrong local time. With serverless hosting and a
5-minute scheduler, the timer cannot be trusted to be precise.

## Decision

1. Compute the fire decision from **local time on every tick**, using the stored IANA zone. Never
   persist a UTC offset.
2. Fire within a **6-hour catch-up window** after the scheduled local time, not at an exact instant.
3. Persist **one digest per `(user_id, iso_week)`** with a unique constraint — the database, not a
   flag in memory, decides whether it has been sent.

## Consequences

- The scheduler only has to be approximately right; correctness comes from the unique key.
- A missed or late trigger still delivers, instead of silently vanishing.
- Spike 4 measured what the alternatives cost: strict timing loses 3 weeks a year to ordinary
  outages, and an in-memory flag produced **357 duplicate emails** in the same scenario.
- A naive fixed-offset scheduler would fire at the wrong local time in **31–34 weeks** for London and
  New York.

## Rejected

- **Strict "exactly 08:00" firing**: one restart at the wrong moment loses the week.
- **In-memory sent flag**: duplicates on every crash.
- **Storing a UTC offset**: silently wrong for every user in a DST zone.

## Revisit when

Per-user digest times or frequency options are introduced — the key stays the same, the key expression
becomes `(user_id, local_date, kind)`.
