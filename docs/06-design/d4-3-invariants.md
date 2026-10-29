# D4.3 — Invariants

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-24
**Scope:** every rule that must never be untrue, the strongest layer that can enforce it, and the test
that proves it.

## The layering rule

For each rule, enforce it at the **strongest layer that can express it**:

> database constraint → transaction → code → screen

A rule pushed down to the database cannot be broken by a bug, an agent, a migration script, or a
future feature. A rule living only in the UI is a suggestion.

Everything below is written as _rule | enforced at | test_.

---

## 0. One decision that determines how ownership is enforced

**The server must not use the service-role key for user requests.**

| Option                                                                                     | Strength                                                                                                        | Weakness                                                                                |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **A. User-session key for user requests; service role only for scheduled ingest** (chosen) | RLS is genuinely enforced on every user-facing query; a bug in a `where` clause cannot leak another user's data | Two database identities to configure; the ingest path must filter by `owner_id` in code |
| B. Service role everywhere, filter by `owner_id` in code                                   | One identity, simpler setup                                                                                     | RLS is decorative — one forgotten `where` clause leaks data, and no test would catch it |

**Recommendation: A.** The scheduled ingest has no user session, so it legitimately uses the service
role — but that path touches exactly one user's rows, resolved from the plus-code, and is covered by
its own tests. Everywhere a human is involved, the database enforces ownership.

---

## 1. Ownership and deletion

| #   | Invariant                                    | Enforced at                                                                      | Test                                                              |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Every row has an owner                       | **DB**: `owner_id uuid not null` FK                                              | schema test                                                       |
| 2   | A user can only read or write their own rows | **DB**: RLS `owner_id = auth.uid()` on every table                               | two users, cross-read returns 0 rows; cross-update returns 0 rows |
| 3   | A row can never reference another user's row | **DB**: composite FK `(application_id, owner_id)` → `applications(id, owner_id)` | direct insert with mismatched owner fails                         |
| 4   | Deleting a user deletes everything they own  | **DB**: `on delete cascade`                                                      | delete user → all six tables have 0 rows for that id              |
| 5   | No orphan rows                               | **DB**: FKs on every link                                                        | insert with a nonexistent parent fails                            |

Rule 3 is the quiet one: without the composite FK, a due item could reference an application owned by
someone else, and the only thing preventing it would be careful code.

---

## 2. Ingest

| #   | Invariant                                       | Enforced at                                                  | Test                                          |
| --- | ----------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| 6   | One `inbound` row per email `Message-ID`        | **DB**: unique index                                         | insert the same message twice → 1 row         |
| 7   | One email can never create two applications     | **DB**: unique `message_id` + single `application_id` column | replay the same email 10× → 1 application     |
| 8   | `status` is one of the six known values         | **DB**: check constraint                                     | insert `'banana'` fails                       |
| 9   | `done` and `ignored` are terminal               | **Code**: state machine                                      | transition test rejects `done → pending`      |
| 10  | Only low-confidence parses reach `needs_review` | **Code**                                                     | parser confidence fixture                     |
| 11  | Raw body is deleted 7 days after receipt        | **Code**: purge inside `ingest()`                            | clock-shifted test asserts `raw_body is null` |
| 12  | Snippet is deleted 30 days after receipt        | **Code**: purge                                              | clock-shifted test                            |
| 13  | A `dead` message counts at most 3 attempts      | **DB**: check `attempts <= 3`                                | force 4 failures → stays 3, status `dead`     |

Rule 13 is enforceable in the database, so it should be. Rule 11 cannot be: it is a statement about
the passage of time, and only code can act on time.

---

## 3. Ledger

| #   | Invariant                                              | Enforced at                                                      | Test                                         |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------------- |
| 14  | `stage` is one of five values                          | **DB**: check constraint                                         | insert `'hired'` fails                       |
| 15  | Stage only moves forward (email-driven)                | **Code**: transition table                                       | all 25 from/to pairs tested                  |
| 16  | Only a user action may correct a stage, never an email | **Code**: separate `correctStage()` path, never called by intake | test asserts intake has no import path to it |
| 17  | Every mutation writes exactly one event                | **Transaction**: state change + event in one tx                  | count events per mutation                    |
| 18  | Events are append-only                                 | **DB**: app role has `insert` only — no `update`, no `delete`    | `update events` → permission denied          |
| 19  | `updated_at` changes on every update                   | **Code**: single write path                                      | trigger-free test                            |

Rule 18 is the strongest thing in this table: a revoked privilege cannot be bypassed by application
code at all.

---

## 4. Planning and delivery

| #   | Invariant                                                       | Enforced at                                                       | Test                                          |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| 20  | `(owner_id, key)` is unique — a generated item cannot duplicate | **DB**: unique index                                              | run `sync()` 5× → 1 item                      |
| 21  | `state` is one of four values                                   | **DB**: check constraint                                          | invalid state fails                           |
| 22  | `snoozed` implies `snoozed_until` is set                        | **DB**: check `(state = 'snoozed') = (snoozed_until is not null)` | insert snoozed without date fails             |
| 23  | `done` and `dismissed` never reopen                             | **Code**: state machine                                           | transition test                               |
| 24  | One digest row per user per ISO week                            | **DB**: unique `(owner_id, iso_year, iso_week)`                   | two digest runs → 1 row                       |
| 25  | `sent` implies `sent_at` is set                                 | **DB**: check                                                     | status write without timestamp fails          |
| 26  | A digest is only sent inside the catch-up window                | **Code**                                                          | clock-shifted test at −1 h, +1 h, +7 h        |
| 27  | No external call inside a database transaction                  | **Code**: convention                                              | **fitness function** (D8), import/usage check |

Rule 27 is the only one that cannot be tested by a unit test — it is a property of code structure, so
it becomes a lint-style check in D8.

---

## 5. Where the layers land

| Layer                   | Count | Examples                                                   |
| ----------------------- | ----- | ---------------------------------------------------------- |
| **Database constraint** | 15    | ownership, uniqueness, enums, cascades, append-only events |
| **Transaction**         | 1     | mutation + event together                                  |
| **Code**                | 11    | state machines, retention, digest window, correction path  |
| **Screen only**         | **0** | deliberately — nothing important is enforced by a button   |

The distribution is deliberate: **the rules that protect data are in the database**, and code is
reserved for rules involving time, sequence, or intent.

---

## 6. What cannot be enforced, only measured

| Wish                                     | Why not enforceable                                | What we do instead                                                                         |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Parser is ≤ 2% wrong                     | It is a statistical property of rules vs real mail | Weekly 20-row audit (A2); golden corpus regressions                                        |
| The digest actually arrives in the inbox | Delivery depends on Gmail and the recipient        | Track `sent_at`; a bounced digest is invisible, so treat "no digest" as a known blind spot |
| The scheduler fires                      | It is outside our trust boundary                   | Heartbeat + stale banner (D1.6)                                                            |
| Emails are forwarded at all              | The user's setup is outside the system             | Time-to-first-application metric (A5)                                                      |

Writing these down prevents a later argument where someone assumes a test covers them.

---

## 7. What becomes a fitness function (D8)

- Import boundary: a module never touches another module's tables.
- No external call inside a transaction.
- Every route that mutates data goes through a module door, not a raw query.
- Event insert accompanies every stage write (a test that greps for writes outside `ledger`).
