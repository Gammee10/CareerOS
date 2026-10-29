# ADR 0008 — Four modules with one-way dependencies

**Status:** Accepted — 2026-10-24
**Related:** [D3 boundaries](../06-design/d3-boundaries.md), [D2 shape](../06-design/d2-shape.md), [principles.md](../principles.md)

## Context

The product has seven Must stories and one part-time builder. The conventional advice is to split the
code by business capability — ingestion, parsing, applications, due, digest, review, identity — which
produces seven modules. For a surface this small, several of those would be shallow: an interface
nearly as large as the code behind it.

D3's own test is whether another part of the code can get real work done by calling one or two
functions without knowing the internals. Capability-first splitting fails that test here.

## Decision

**Four modules, each owning its tables and exposing at most four functions:**

| Module     | Owns                      | Doors                                                |
| ---------- | ------------------------- | ---------------------------------------------------- |
| `intake`   | `inbound`, `review_items` | `ingest`, `listReview`, `resolveReview`, `reprocess` |
| `ledger`   | `applications`, `events`  | `create`, `update`, `get`, `list`                    |
| `planning` | `due_items`               | `listDue`, `complete`, `snooze`, `sync`              |
| `delivery` | `digests`                 | `sendIfDue`, `preview`                               |

**Dependencies are one-way and acyclic:** `intake → ledger ← planning ← delivery`. Modules never read
another module's tables; routes and pages sit above all four and may call any of them.

## Consequences

- **Every module is deep**: one door hides IMAP, parsing, queueing, review routing; another hides the
  schema, events and transition rules.
- **`intake` is the largest module** and the main risk. Guard: its public surface stays at four
  functions, and `parser/` and `queue/` remain private subfolders with no external surface.
- **A fifth door in `intake` is a signal**, not an error — it means a new boundary has appeared and
  should be created deliberately.
- **Splitting later is mechanical**, because the private subfolders are already the cut lines.
- Operator tools — migrations and the backup export — are explicitly exempt and may touch tables
  directly.

## Rejected

- **Seven capability modules**: several would be shallow; more doors to maintain for one developer.
- **No modules at all**: fastest to start, but every change reaches across the codebase, which is the
  failure D8 exists to prevent.
- **Services**: the microservice premium, paid for traffic that does not exist.

## Revisit when

A module needs its own deployment or runtime, a second developer works in parallel on different
modules, or `intake` legitimately needs a fifth door.

## Amendment — 2026-10-24

D4.1 folded the separate `review_items` table into `inbound` as a status value. `intake` now owns** one table, `inbound`. The module boundary and its four doors are unchanged.
