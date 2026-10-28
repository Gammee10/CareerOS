# Spike 3 — Can simple rules read an application email?

**IDs:** U3
**Box:** 1 day
**Status:** ✅ answered — **rules only**, 90% frozen (80% on real emails)
**Date:** 2026-10-22

## The question, in plain words

An email arrives: *"Thank you for applying to Northbeam — we'd like to invite you to interview."*
Can plain, deterministic rules reliably pull out **company**, **role**, and **stage** — or do we
need an AI model to read it?

And if rules work: **how much work is each new employer's format?**

## Why this decides the build

| Approach | Cost | Risk |
|---|---|---|
| **Rules only** | Free, instant, deterministic, testable, private | Brittle on unseen formats |
| **Rules + LLM fallback** | A few cents per unknown email; sends content to a third party | Privacy, latency, new failure mode |
| **LLM for everything** | Cost scales with every email | The parser becomes a black box we can't unit-test |

Rules are the default because they are free, private and debuggable. The spike answers whether that
default survives contact with reality — and if it does not, the LLM decision is forced by evidence
rather than taste.

## The honest caveat, stated before we start

The user no longer has access to their real application emails, so **there is no real corpus**.
Whatever we measure here is **structural feasibility, not real-world precision**.

Two consequences, both accepted:

1. Results are indicative. A later pass with real inbox data must confirm them.
2. Synthetic corpora flatter the parser, because the same mind writes both the corpus and the rules.
   **Guard: a held-out split.** Rules are tuned on half the templates and measured on the other half,
   which the rule-writing never sees.

## The plan

### Step 1 — Build the corpus (mixed roles)

- **Me:** draft 10 templates covering the main families — Greenhouse, Lever, Workday,
  SmartRecruiters, LinkedIn, direct company mail, recruiter outreach, assessment invite, rejection,
  offer.
- **User:** reconstruct up to 5 real ones from memory (sender address, subject line, first two lines
  of the body) — even fragments help, since they encode real phrasing.
- **User:** mark my templates that look unrealistic, and name any family I missed.
- Every template carries known ground truth: company, role, stage, whether it has a date/ask.

### Step 2 — Split

Random but fixed assignment: **half tune, half hold out**. The held-out half is opened once.

### Step 3 — Write the parser (me)

Deterministic only. Input: the normalised message (From, Subject, body text, `X-Forwarded-To`).
Output: best-guess company, role, stage, plus a confidence signal. No ML, no network calls.

### Step 4 — Measure (me)

For every email in the held-out half, record each field as **correct / wrong / missing**.
Report:

- **Full-resolution rate** — emails where all three fields are correct.
- **Field-level accuracy** — company, role, stage separately.
- **Error shape** — wrong-but-plausible vs missing (a wrong value is worse than a blank).
- **Effort per new template** — minutes and rules added to cover one unseen family.

### Step 5 — Decide (both)

## Decision thresholds (fixed before the result)

| Full-resolution rate on held-out emails | Decision |
|---|---|
| **≥ 80%** | Rules only in v1. Everything else goes to Review, as the spec already says |
| **50–80%** | Rules with an explicit Review queue as the norm — and measure the queue's size, because a review queue that fills daily is just manual entry with extra steps |
| **< 50%** | Rules are not viable; either add an LLM fallback or narrow the supported formats to one ATS |

## Roles

| Who | Does |
|---|---|
| **Me** | Draft the corpus, write the throwaway parser, run the measurement, report numbers, delete the code |
| **User** | Reconstruct up to 5 real emails from memory; sanity-check the synthetic ones; approve the start |

## What would make me abandon this spike

If the user cannot produce even fragments and the synthetic corpus is judged unrealistic, the
measurement is theatre. In that case the honest outcome is **"not measurable yet"**, and the decision
falls back to the spec's narrow scope: support one or two ATS families and route the rest to Review,
with a real measurement scheduled after the first month of use.

## Result

### Frozen measurement (the honest number)

Rules were written against the 5 tune emails only, then scored once against the held-out sets.

| Split | Full resolution | Company | Role | Stage |
|---|---|---|---|---|
| Held-out synthetic (5) | 5/5 (100%) | 3/3 | 3/3 | 3/3 |
| **Held-out real (5)** | **4/5 (80%)** | 5/5 | 4/5 | 5/5 |
| **Combined** | **9/10 (90%)** | | | |

Single failure: **R2 (LinkedIn acknowledgement)** — the role was not extracted. LinkedIn puts the job
title on its own line, and the parser collapsed newlines before scanning. A structural bug in my
code, surfaced by real data — which is what a held-out set is for.

### Post-hoc fix (not a clean measurement)

The collapse was fixed (line-aware scanning) and the suite re-run: **10/10 (100%)**.

Reported separately because it is no longer a held-out result — I fixed the code *after* seeing the
failure. The decision is unaffected (both 90% and 100% clear the ≥80% bar), but the 100% must not be
quoted as if it were blind.

### Error shape — better than expected

Across the held-out run there were **no wrong values**, only one *missing* one. That matters more than
the headline: a missing field is recoverable through the Review queue; a wrong-but-plausible company
or stage is what silently corrupts the product.

**Except one case worth watching:** R2's company was extracted as `Fernhill Analytics Data` — the
truth plus the beginning of the next line. It scored as correct only because the scoring allows
containment. In production that string would be stored, and it is the sort of quiet over-capture that
makes a list feel broken.

### Effort per new format

- The whole parser is ~190 lines of rules for 15 emails.
- Adding the LinkedIn line format cost one rule discovered by failure, not by design.
- Estimate: **10–20 minutes per newly-seen ATS family**, and *only after* an email from that family
  has actually arrived and failed. Unknown families are not predicted, they are discovered.

### Decision

**Rules only in v1.** 90% (frozen) and 80% on real emails both clear the ≥80% threshold. No LLM, no
third-party transfer of email content, no per-email cost.

The Review queue stays — it is what catches the 10% and every unseen format.

### Caveats that must travel with this number

1. **The real corpus is 100% acknowledgements.** Stage classification — the part with real
   consequences — is untested on genuine data. Calling a rejection "applied" is the error that would
   hurt, and we have not seen it happen or not happen.
2. **n = 10.** Three wrong would move the result by 30 points.
3. **The synthetic emails were written by the same person who wrote the rules.** The synthetic 100%
   flatters.
4. **Containment scoring is lenient** and hid one noisy company value.

**Re-measure with the first month of real forwarded mail** before trusting the number for anything
beyond "rules are viable".

