# D3 — Boundaries: how the inside is split

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-24
**Decision carried in:** four deep modules, not seven shallow ones. The template's rules are kept;
only its starting point (decompose by capability list) is dropped.

## The test every module must pass

> Can another part of the code get real work done by calling **one or two functions**, without
> knowing how it works inside?

If the answer is no, the module is shallow and should be merged.

---

## 1. The four modules

### `intake/` — from mailbox to a recorded application

|                  |                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Owns tables**  | `inbound` (the job queue), `review_items` (things it could not decide)                                                                                       |
| **Public doors** | `ingest(now)` · `listReview(owner)` · `resolveReview(owner, id, decision)` · `reprocess(owner, inboundId)`                                                   |
| **Hides**        | IMAP connection and MIME parsing · the rule engine · confidence scoring · claim/lease/retry/dead-letter · when to send something to Review · retention purge |
| **Calls**        | `ledger.create()` / `ledger.update()` when it is confident                                                                                                   |

`ingest()` also expires old raw emails at the end of each cycle. That is deliberate: one door keeps
the inbox current — fetch, parse, expire — and it avoids a fifth door for housekeeping.

### `ledger/` — the applications and their history

|                  |                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Owns tables**  | `applications`, `events`                                                                                           |
| **Public doors** | `create(owner, input)` · `update(owner, id, patch)` · `get(owner, id)` (includes timeline) · `list(owner, filter)` |
| **Hides**        | The schema · event writing on every mutation · allowed status transitions · duplicate detection                    |
| **Calls**        | nothing                                                                                                            |

`ledger` is the only module that touches `applications`. If the digest, the due list, or a future
analytics page needs applications, it asks `ledger`.

### `planning/` — what is owed next

|                  |                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Owns tables**  | `due_items` (dates extracted from mail, silence prompts, and the user's done/snooze/dismiss state)          |
| **Public doors** | `listDue(owner, now)` · `complete(owner, id)` · `snooze(owner, id, until)` · `sync(owner, now)`             |
| **Hides**        | The silence rule · local-time arithmetic · catch-up windows · how generated items are kept from duplicating |
| **Calls**        | `ledger` (reads applications to know what is quiet)                                                         |

### `delivery/` — the Monday email

|                  |                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- |
| **Owns tables**  | `digests` — unique on `(owner, iso_year, iso_week)`                                   |
| **Public doors** | `sendIfDue(owner, now)` · `preview(owner)`                                            |
| **Hides**        | Eligibility (Monday 08:00 local, 6-hour catch-up) · composition · SMTP · retry policy |
| **Calls**        | `planning.listDue()`                                                                  |

---

## 2. Allowed arrows

| From ↓ / To → | intake | ledger | planning | delivery |
| ------------- | ------ | ------ | -------- | -------- |
| **intake**    | —      | ✅     |          |          |
| **ledger**    |        | —      |          |          |
| **planning**  |        | ✅     | —        |          |
| **delivery**  |        |        | ✅       | —        |

**No cycles. No skipping.** `delivery` cannot call `ledger` even though it would be convenient — it
asks `planning`, which asks `ledger`. That is the price of a single direction, and it is cheap here
because the chain is two calls deep, not ten.

**Routes and pages sit above all four.** A page may call any module; a module may never call a page.
If a screen needs two modules, the route sequences them — that is the whole "use-case layer", and it
is deliberately not a folder.

---

## 3. One rule, one place

| Rule                                      | Owner        | Enforced at                           |
| ----------------------------------------- | ------------ | ------------------------------------- |
| Company / role / stage extraction         | intake       | code + golden-corpus tests            |
| Confidence threshold for review           | intake       | code                                  |
| A message becomes at most one application | intake       | unique `inbound.message_id`           |
| Allowed status transitions                | ledger       | code + database check                 |
| Every mutation writes an event            | ledger       | one transaction                       |
| A user sees only their rows               | every module | database RLS, `owner_id = auth.uid()` |
| Silence prompt after 10 quiet days        | planning     | code + unique key                     |
| Digest eligibility and catch-up           | delivery     | code                                  |
| One digest per user per week              | delivery     | unique `(owner, iso_year, iso_week)`  |
| Raw email 7 days, snippet 30 days         | intake       | scheduled purge inside `ingest()`     |

**Duplicated rules are the smell.** If a rule appears in a second module, one of them is wrong — the
second should call the first.

---

## 4. The guard against a god-module

`intake` is the biggest module, and the honest risk is that it becomes the place everything vaguely
email-related gets dropped.

**The rule:** its public surface stays at **four functions**. A fifth need is not an error — it is a
signal that a new module boundary has appeared, and should be created deliberately rather than by
adding a door.

Inside `intake`, the pieces stay private:

```
intake/
  index.ts          the four doors
  imap/             connection, fetch, dedupe
  parser/           rules, confidence   (no public surface outside intake)
  queue/            claim, lease, retry, dead-letter
  review/           routing to review_items
  retention.ts      purge
```

`parser/` and `queue/` are exactly where a future split would cut, if one is ever needed. Keeping
them as clean subfolders now is what makes that a day's work later instead of a week's.

---

## 5. Smells, and which become machine checks

| Smell                                      | Check (built in D8)                                                  |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Two modules write the same table           | dependency test: table access only through its owning module         |
| A module imports another's `db/` or schema | import-boundary test                                                 |
| An arrow that should not exist             | import graph must match the matrix above                             |
| A rule copied into a second module         | review checklist — the one thing a machine cannot find               |
| A `utils/` folder everyone imports         | forbid a shared dumping ground; shared helpers live with their owner |

---

## 6. Explicitly exempt: operator tools

Migrations and the nightly backup export touch tables directly and are **outside** the module rules.
They run as operator tools with service credentials — the same category as a `pg_dump`, not
application logic. Written down so it is an exemption with a reason rather than an accident.

---

## 7. What this does not do

It does not make the code easy to split into services, and it is not meant to. It makes **one person
able to change one part without reading the rest**, which is the only changeability driver we have
(D1's changeability targets, Q14/Q15).
