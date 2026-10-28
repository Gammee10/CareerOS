# Stage 5 — Technical discovery

**Status:** 🟡 in progress — Step 1 approved, Spike 1 awaiting user data
**Date:** 2026-10-20

This stage is split by step. One file per step, one file per spike. Nothing gets squeezed.

## Method

Nine steps, one at a time. Draft → review → approve → next.

**Spike protocol (agreed with the user):**

1. I explain the spike in plain language — what question it answers and why it matters.
2. I explain how we will run it, in order. If it runs on the user's side, they get concrete
   instructions. If it is code, the plan comes first and I wait for the signal before writing it.
3. One spike at a time. Result written as a number or a clear yes/no. Throwaway code is deleted.
   A spike that becomes the product has failed as a spike.

**Standing bias:** managed, boring, free-tier tools. Any operational surface a solo builder must
babysit is rejected unless it is the core value. The core value is **ingestion and the due list**;
everything else is bought or borrowed.

## Progress

### Steps

| # | Step | Status | Doc |
|---|---|---|---|
| 1 | List the unknowns | ✅ approved | [05-step-1-unknowns.md](05-step-1-unknowns.md) |
| 2 | Run time-boxed spikes | ✅ 5 spikes done | [05-spike-1-email-corpus.md](05-spike-1-email-corpus.md) |
| 3 | Build, buy, or borrow | ✅ approved — $0 stack | [05-step-3-build-buy-borrow.md](05-step-3-build-buy-borrow.md) |
| 4 | Choose the stack | ✅ approved | [05-step-4-stack.md](05-step-4-stack.md) |
| 5 | Record ADRs | ✅ 0001–0007 | [adr/](adr/) |
| 6 | Running costs per month | ✅ $0 | [05-step-6-costs.md](05-step-6-costs.md) |
| 7 | Legal and privacy | ✅ controls listed | [05-step-7-legal-privacy.md](05-step-7-legal-privacy.md) |
| 8 | Architecture drivers (Template R) | ✅ 15 targets | [05-step-8-drivers.md](05-step-8-drivers.md) |
| 9 | Architecture-risk spike | ✅ 1.7 s in-region | [05-step-9-architecture-spike.md](05-step-9-architecture-spike.md) |

### Spikes

| # | Question | Box | Status |
|---|---|---|---|
| 1 | Do real application emails carry a date or next action? (U1/U2) | 1 h | ✅ answered — 26.7%, band 2 |
| 2 | Can a free-tier stack receive inbound email end to end? (U4) | 1 day | ✅ **PASS** — route on `X-Forwarded-To` |
| 3 | Rule-based parser precision on the real corpus (U3) | 1 day | ✅ rules only — 90% frozen |
| 4 | Scheduled job at local 08:00 + cold-start latency (U5/U6) | 1 day | ✅ Part A pass; host deferred |
| 5 | DB-backed queue on the free tier (U7) | 0.5 day | ✅ **6/6 passed** on real Postgres |
