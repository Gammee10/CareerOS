# Stage 6 — Design (index)

**Status:** 🟡 in progress — D3 approved, D4 next
**Date:** 2026-10-24

Design describes what will be built, and why. Decisions that pass the significance test move to
`docs/adr/`.

| Step | Question | Status | Doc |
|---|---|---|---|
| **D1** | What must be true? | ✅ approved | [d1-drivers.md](d1-drivers.md) |
| **D2** | What are the big parts? | ✅ approved | [d2-shape.md](d2-shape.md) |
| **D3** | How is the inside split? | ✅ approved | [d3-boundaries.md](d3-boundaries.md) |
| **D4** | What data, and what must never be untrue? | ✅ approved (8/8) | [d4-1-entities.md](d4-1-entities.md) |
| **D5** | How do the parts talk? | ✅ approved | [d5-interfaces.md](d5-interfaces.md) |
| **D6** | How do we run and see it? | ✅ approved | [d6-operate.md](d6-operate.md) |
| **D7** | What could be wrong? | ✅ approved | [d7-challenge.md](d7-challenge.md) |
| **D8** | How do we stop it rotting? | 🟡 draft | [d8-protect.md](d8-protect.md) |

## D4 sub-steps

D4 is the broadest step, so it runs one piece at a time.

| # | Piece | Status |
|---|---|---|
| D4.1 | Entities and relationships | ✅ approved — [d4-1-entities.md](d4-1-entities.md) |
| D4.2 | State machines (what may happen to each thing) | ✅ approved — [d4-2-states.md](d4-2-states.md) |
| D4.3 | Invariants — rule, where enforced, test | ✅ approved — [d4-3-invariants.md](d4-3-invariants.md) |
| D4.4 | Source of truth — one owner per fact | ✅ approved — [d4-4-source-of-truth.md](d4-4-source-of-truth.md) |
| D4.5 | Concurrency — what if two things happen at once | ✅ approved — [d4-5-concurrency.md](d4-5-concurrency.md) |
| D4.6 | Consistency boundaries — what changes together | ✅ approved — [d4-6-consistency.md](d4-6-consistency.md) |
| D4.7 | Data life cycle — retention, deletion, backup, migration | ✅ approved — [d4-7-lifecycle.md](d4-7-lifecycle.md) |
| D4.8 | Time and money | 🟡 draft — [d4-8-time-money.md](d4-8-time-money.md) |

**Deliberate reorder:** the template lists invariants (D4.2) before state machines (D4.4). Invariants
are statements about allowed transitions, so they are easier to write once the states exist. States
first, rules second.

## ADRs from this stage

| ADR | Decision |
|---|---|
| [0008](../adr/0008-four-modules.md) | Four modules with one-way dependencies (from D3) |
