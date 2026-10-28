# D8 — Protect: stop the design from rotting

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-26
**Scope:** the rules that matter turned into checks a machine runs, the rules a machine cannot check
written where an agent will read them, and the date we look at all of this again.

## 1. What actually rots

Designs do not fail in one dramatic moment. They erode:

| Rot | How it starts | Caught by |
|---|---|---|
| **A module reaches into another's table** | "It's just one query, and the join is easier here" | import boundary check |
| **A rule gets copied** | "I need the silence rule here too, so I'll paste it" | review — no machine finds this |
| **A migration becomes destructive** | "I'll just rename the column" | migration diff check |
| **A derived column drifts** | A new write path skips `last_activity_at` | nightly reconciliation |
| **An external call lands inside a transaction** | "Sending the email here is simpler" | convention + review |
| **The rules file goes stale** | The design changes, the file doesn't | review at the design's revisit date |
| **Tests stop matching reality** | The golden corpus is never updated | failing parser tests on real formats |

## 2. Fitness functions — the machine checks

Cheap ones run on every push; slow ones run nightly.

| # | Rule | Check | Tool | When | Failure looks like |
|---|---|---|---|---|---|
| F1 | Modules only import downward | import graph matches the allowed matrix (D3) | **dependency-cruiser** | every push | "`delivery` may not import `ledger`" |
| F2 | Only `ledger` touches `applications` | forbidden-import rule per module on `db/schema` and raw SQL | dependency-cruiser + grep | every push | "raw SQL outside its owning module" |
| F3 | No secrets in the repo | secret scan | gitleaks | every push | "possible credential in `src/...`" |
| F4 | Only permissive licences | licence list diff | `pnpm licenses list` + allowlist | every push | "GPL-3.0 dependency added" |
| F5 | The service-role key never reaches the client | grep the production build output for the env **name** and the key prefix | build script | every push | "`SUPABASE_SERVICE_ROLE` appears in a client chunk" |
| F6 | Every state transition has a test | coverage of `ledger/transitions` and `planning/states` | vitest coverage threshold | every push | "transition matrix 18/25 covered" |
| F7 | RLS actually blocks cross-user access | two users, cross-read and cross-write must affect 0 rows | integration suite | nightly | "user A read 1 row belonging to B" |
| F8 | Schema invariants hold | attempt each forbidden insert from D4.3 and assert it fails | integration suite | nightly | "inserting stage='hired' succeeded" |
| F9 | Replays create nothing | enqueue the same `message_id` 10× | integration suite | nightly | "2 applications for one message" |
| F10 | The due list stays fast | seed 10× data, assert query < 100 ms | integration suite | nightly | "due query 340 ms at 10× rows" |
| F11 | Derived data does not drift | recompute `last_activity_at` from events, compare | reconciliation job | nightly | "3 rows differ from their events" |
| F12 | Migrations are additive | diff the new schema against the previous; fail on `DROP COLUMN`, `RENAME`, or type change without an expand/contract marker | script over generated SQL | every push | "destructive change without a marker" |
| F13 | The design docs still match the ADRs | every ADR's decision appears in the design pack | manual, at review | quarterly | — |

**F11 runs in production, not in CI** — it is the reconciliation from D4.4, and it is the only check
that can see real drift.

**F13 is deliberately manual.** Automating "does the document still describe the system" is a
research project; a scheduled read is cheaper and more honest.

### Decision — how are module boundaries enforced?

| Option | Strength | Weakness |
|---|---|---|
| **A. `dependency-cruiser` with an allow-list** (chosen) | Declarative matrix, runs in one second, readable error messages, no runtime cost | One more dev dependency to configure |
| B. `eslint-plugin-boundaries` | Reuses the lint pipeline | Configuration is more awkward for cross-folder rules; less expressive graph analysis |
| C. Code review only | No tooling | The rule erodes the first time someone is in a hurry — which is always |

**Recommendation: A.** The matrix from D3 becomes a literal configuration file, which means the design
document and the build agree by construction.

## 3. What a machine cannot check, written where an agent will read it

A `RULES.md` at the repository root, short enough to be read every time. Agents add code in the
nearest plausible place and copy logic they find; this file is the counterweight.

```markdown
# Rules for this repository

## Shape
- Four modules: intake, ledger, planning, delivery. One-way imports only:
  intake → ledger ← planning ← delivery. No cycles, no skipping.
- A module never touches another module's tables. Ask the module, not the database.
- Routes and pages sit above all four and may call any of them.

## Data
- Only `ledger` writes `applications` and `events`. Every mutation writes its event in the
  same transaction.
- `owner_id` on every row. Never write a query that ignores it.
- Never log email bodies, subjects, or addresses.

## Time
- Store `timestamptz` in UTC. Store timezones as IANA names. Convert only at the edges.
- Date-only facts use `due_date`, instants use `due_at`. Exactly one.
- Never store a derived value; compute it.

## Safety
- No external call (IMAP, SMTP, HTTP) inside a database transaction.
- Every retryable operation is idempotent through a unique key, not a flag in memory.
- Migrations are additive. Expand, migrate, contract. Never rename in one step.

## Tests
- Every state transition has a test.
- Every fixed bug gets a regression test with the real input.
```

**The rules file is versioned with the code and reviewed at the design's revisit date.** A stale rules
file is worse than none, because it teaches the wrong pattern with authority.

## 4. When things run

| Frequency | Checks | Time budget |
|---|---|---|
| **Every push** | F1–F6, F12, plus typecheck, lint, unit tests | < 2 minutes |
| **Nightly** | F7–F10 (integration against a dedicated test user on the real database) | < 5 minutes |
| **Nightly (production job)** | F11 reconciliation, export, retention purge | seconds |
| **Quarterly** | F13 document review, rules file review | 30 minutes |

**The integration suite runs against the real Supabase project with a dedicated test user**, cleaning
up after itself. A second project would be cleaner but the free tier allows only two, and one is
already a disposable spike. The test user is the pragmatic compromise, and it is why F7 asserts
`0 rows affected` rather than trusting the code.

## 5. When we look at this again

| Trigger | Review |
|---|---|
| **Launch + 1 month** | Do the SLOs hold? Is the Review queue empty or overflowing? Is the digest being read? |
| **Launch + 3 months** | Full design review: do the drivers still describe reality? Are any ADRs expired? |
| **Any ADR's revisit trigger fires** | That ADR is reopened, not the whole pack |
| **The free-tier terms change** | ADR 0002 / 0001 reopened |
| **A module needs a fifth door** | D3 boundary review |

**The design is assumed to expire.** A design nobody revisits is a story about the past being used to
justify the present.

## 6. What we deliberately do not check

| Not checked | Why |
|---|---|
| "Is the code clean?" | Taste, not a property; review covers it |
| "Is the architecture still right?" | Not mechanisable — that is what the revisit date is for |
| Coverage percentage targets | A number that rewards testing getters |
| Every module's line count | Measures the wrong thing; `intake` is meant to be big |

## 7. Stage 6 is complete

Eight steps. What exists: seven drivers and their conflicts, two diagrams and five trust boundaries,
four modules with an arrow matrix, six tables with four state machines and 27 invariants, three
boundary contracts, three SLOs, eleven failure-ticket pairs, a threat model, a pre-mortem, and a set of
checks that will outlive everyone's memory of why they exist.
