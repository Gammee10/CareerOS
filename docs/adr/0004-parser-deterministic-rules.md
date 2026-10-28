# ADR 0004 — The parser is deterministic rules, not a language model

**Status:** Accepted — 2026-10-22
**Evidence:** Spike 3 (90% frozen, 80% on real emails)
**Related:** Stage 4 S1–S3, Review queue

## Context

Application emails must be turned into `{company, role, stage}`. Two options: hand-written rules, or
an LLM. The choice decides cost per email, latency, testability, and — most importantly — whether
other people's email content leaves our system.

## Decision

**Deterministic rules only in v1.** No LLM call anywhere in the ingest path.

Rules are written against real sender formats, measured with unit tests, and versioned in the repo.
Anything they cannot resolve goes to the **Review queue** rather than being guessed at.

## Evidence

- 90% of held-out emails fully resolved (80% on the owner's real emails); zero *wrong* values, one
  missing.
- Every failure was a *missing* field, which the Review queue recovers — not a wrong value, which
  silently corrupts.
- Adding a new sender family costs 10–20 minutes, discovered when its first real email fails.

## Consequences

- Free, instant, offline-capable, and unit-testable.
- Recall on unseen formats is bounded — by design, those go to Review.
- No email content is transmitted to a third party.
- The parser can be improved incrementally with a corpus and tests, which an LLM prompt cannot.

## Revisit when

The Review queue stays unresolved for more than 10% of ingested mail over a month (the Stage 4
guardrail). At that point an LLM fallback for *only* the unresolved items is the upgrade path — the
queue is already the seam that makes it additive.
