# D4.7 — Data life cycle

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-24
**Scope:** how long each kind of data lives, how it dies, what is backed up, how a restore works, and
how schemas change without breaking the running app.

## 1. Retention

| Data | Lives for | Then | Why |
|---|---|---|---|
| `inbound.raw_body` | **7 days** | set to `null` | Enough to debug and re-parse a bad ingest; longer is a liability |
| `inbound.snippet` | **30 days** | set to `null` | Context in the UI, then no longer worth keeping |
| `inbound` metadata (`message_id`, `from_address`, `subject`, `parsed`, status) | **12 months** | row deleted | The audit trail of what was processed — and the dedupe key |
| `applications` | until the user deletes them | row deleted | It is the product |
| `events` | until the user deletes the application | deleted by cascade | History of that application |
| `due_items` | until the user or the application deletes them | deleted by cascade | User decisions are authoritative |
| `digests` | **12 months** | row deleted | Only the current week matters for idempotency; the rest is a log |
| `profiles` | until the user deletes their account | everything cascades | — |

**The shape:** *content* is short-lived, *structure* is long-lived. What the email said disappears in
days; that an email arrived and what we made of it survives a year; the applications themselves
survive until you delete them.

## 2. Deletion

| Action | What happens |
|---|---|
| User deletes an application | Its events and due items cascade. The `inbound` rows stay (with `application_id` set to `null`) so the audit trail survives — the email arrived, we processed it, the application was yours to delete |
| User deletes their account | `profiles` row deleted → **everything cascades**: applications, events, due items, digests, inbound |
| Retention purge | Runs inside `ingest()`; sets bodies/snippets to `null` on schedule, deletes rows past their window |
| Backup expiry | Exports rotate after **7 days** |

**The honest gap:** deleting an application does not remove it from the previous night's export until
that export rotates out, up to 7 days later. Written down here so "delete" is not oversold.

## 3. Backup and restore

The free tier has no database backups (Stage 5, R4), so we make our own.

| | |
|---|---|
| **What** | A logical export of all six tables as JSON, one file per night |
| **Where** | Supabase Storage, private bucket |
| **How often** | Nightly, triggered by the same scheduler |
| **Rotation** | 7 files, oldest deleted |
| **RPO (structured data)** | **24 hours** |
| **RTO** | **4 hours** — download, restore into a fresh Supabase project, update one connection string, redeploy |
| **Rehearsal** | Once, in Stage 10, on a throwaway project. A backup that has never been restored is a belief |

**What it does not protect against:** losing Supabase itself, because the exports live there too. The
mitigation is manual — the owner can download the latest export at any time. For a single-user
portfolio project that is an acceptable hole, and it is stated rather than hidden.

**What cannot be recovered at all:** anything typed after the last export, and the Gmail mailbox
itself (R2). Everything else is rebuildable from Gmail plus the export.

## 4. Migrations — expand and contract

The app deploys as one unit, but **the database changes before the code does**. A migration that
breaks the currently-running version turns a routine deploy into an outage.

**The rule: every migration is additive and backward-compatible, in three steps.**

| Step | Deploy | Database |
|---|---|---|
| **1. Expand** | — | Add the new column/table, nullable or defaulted. Nothing reads it yet |
| **2. Migrate** | New code that writes *both* old and new | Backfill existing rows |
| **3. Contract** | Code that reads only the new shape | Drop the old column/table |

**Worked example — renaming `dedupe_key` to `match_key`:**

1. Add `match_key text` (nullable).
2. Deploy code that writes both `dedupe_key` and `match_key` on every insert.
3. Backfill: `update applications set match_key = dedupe_key where match_key is null`.
4. Deploy code that reads `match_key`, still writing both.
5. Add the unique index on `match_key`; drop the old index.
6. Deploy code that writes only `match_key`; drop `dedupe_key`.

Six small steps instead of one risky one. For a single user the risk of a broken deploy is small, but
the **habit** is what makes the difference when it matters.

**Migration runner:** Drizzle's migration files, applied by a script before the deploy step, never
automatically at runtime. Migrations are tracked in the repository and are the only operator code
allowed to touch tables directly (D3 §6).

## 5. Classification and protection

| Tier | Data | Protection |
|---|---|---|
| **1. Account** | Email address, timezone | RLS by `owner_id`; TLS in transit; encrypted at rest by Supabase |
| **2. Third-party PII** | Recruiter names, interviewer addresses inside emails, `from_address` | 7-day body retention, snippet 30 days, metadata 12 months |
| **3. Sensitive in passing** | Salary figures, visa status, health details that appear in emails | Same as tier 2 — we do not parse or store them deliberately; they ride along and expire in 7 days |
| **4. Derived** | Stage, due dates | No special treatment |

The whole design minimises tier 2 and 3 by **not keeping what we do not need**: the raw email exists
for a week to serve debugging, not as an archive. Gmail remains the archive.

## 6. Open for the last sub-step

| Question | Step |
|---|---|
| How are timestamps stored and displayed? Any money? | D4.8 |
