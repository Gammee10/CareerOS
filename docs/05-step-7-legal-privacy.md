# Stage 5 · Step 7 — Legal and privacy

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-22
**Posture:** personal, non-commercial project. No payments, no ads, no sharing. This is the honest
starting position — if that changes, this page changes with it.

## What we store

| Data | Where | Why | Retention |
|---|---|---|---|
| Email address | Supabase Auth | Login | Until account deletion |
| Timezone (IANA) | Postgres | Digest timing | Until account deletion |
| Applications: company, role, stage, dates, notes | Postgres | The product | Until deleted by user |
| Status-change events | Postgres | History, analytics later | Until deleted by user |
| Raw forwarded email | Postgres | Debug and re-parse | **7 days**, then body deleted |
| Per-email snippet (500 chars) | Postgres | Context in the UI | **30 days** |
| Latest snippet per application | Postgres | What the user sees | While the application exists |
| IMAP/SMTP credential | Vercel env only | Read the mailbox, send the digest | Not in the database, never in the repo |

**The uncomfortable part:** forwarded emails contain **other people's personal data** — recruiters'
names, interviewers' email addresses, sometimes salary details. We do not choose to collect it; it
rides along. Our answer is **minimisation**: 7 days of raw, snippets after that, structured fields
only thereafter.

## Who processes what

| Processor | Sees | Terms risk |
|---|---|---|
| **Google (Gmail)** | Every forwarded email, in full, already | Automation via app password is permitted for the account owner, but Google may act on accounts it considers abusive |
| **Supabase** | The database, including the 7-day raw emails | Standard DPA; free tier has no backups |
| **Vercel** | Request logs; the app runs there | Hobby is **personal, non-commercial** only |
| **cron-job.org** | Only the ingest URL and a shared secret | Free, no SLA, no data |

Nothing is sent to an LLM (ADR 0004), which removes the largest and most casual privacy risk most
products of this type carry.

## Legal posture

- **Personal project, single user, no monetisation.** Not a data controller in any commercial sense.
- **If it ever becomes public or commercial**, the duties change: lawful basis, right to erasure, a
  privacy policy, breach notification, and a processor agreement reviewed by someone qualified. That
  is a decision for that day, not this one.
- **Data-subject rights, honoured in code regardless:** the user can export and delete everything.
  Building that now is cheaper than retrofitting it, and it is the right default even where the law
  does not yet compel it.

## Security controls that must exist before real data (Stage 7 gates)

1. **Row-level security on every table**, policy `owner_id = auth.uid()`. The Supabase anon key is
   public by design; without RLS, "authentication" is theatre.
2. **The ingest endpoint requires a bearer secret.** It is a public URL that reads a mailbox — an
   unauthenticated version would let anyone trigger ingestion and, worse, learn from its responses.
3. **Service-role key never reaches the browser.** Only the anon key ships to the client.
4. **No email content in logs.** Subject lines and error messages are logs; bodies are not.
5. **A retention job** that actually deletes raw bodies after 7 days and snippets after 30. A
   documented policy nobody enforces is a lie.
6. **A one-page privacy note** in the app, in plain language: what is stored, for how long, how to
   delete it.

## Open-source licences

Everything chosen is permissively licensed — verified `imapflow` **MIT** from the package metadata;
Next.js, React, Tailwind, Zod, Luxon, nodemailer and mailparser are MIT; Drizzle is Apache-2.0.
None is copyleft in a way that constrains a hosted product.

**Stage 7 gate:** run `pnpm licenses list` in CI and fail on anything non-permissive. Cheap now,
awkward after a dependency is load-bearing.

## The two risks I would not wave away

- **Google can disable the mailbox**, taking ingestion and delivery with it (ADR 0001/0002). Nothing
  in our control prevents that; the mitigation is that the source emails still exist.
- **Free hosting is not a contract.** Vercel's non-commercial clause and Supabase's no-backup policy
  are terms we accept, not guarantees we receive.
