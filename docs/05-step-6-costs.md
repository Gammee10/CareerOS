# Stage 5 · Step 6 — Running costs

**Status:** 🟡 draft, awaiting review
**Date:** 2026-10-22
**Sources:** Supabase pricing (fetched 2026-10-22), Vercel plan docs, Gmail limits.

## Current monthly cost

| Item | Plan | Cost |
|---|---|---|
| Vercel (web + ingest) | Hobby | $0.00 |
| External scheduler | cron-job.org free | $0.00 |
| Supabase (Postgres + Auth) | Free | $0.00 |
| Gmail (in and out) | Personal account | $0.00 |
| Domain | none | $0.00 |
| **Total** | | **$0.00** |

## Estimated usage — one user

| Resource | Monthly usage | Free allowance | Headroom |
|---|---|---|---|
| Ingest invocations | ~8,760 (every 5 min) | generous | large |
| Ingest compute | ~12 hours | Hobby quota | large |
| Digest invocations | ~744 (hourly) | generous | large |
| Emails received | ~30 | Gmail IMAP | trivial |
| Emails sent | ~4 | Gmail SMTP ~500/day | trivial |
| Database size | **< 5 MB in year one** | 500 MB | ~100× |
| Egress | < 100 MB | 5 GB | ~50× |

## Cost as the product grows

The architecture has an unusual shape: **polling is per mailbox, not per user**, so compute does not
scale with users. One mailbox serves everyone, and the same 12 hours a month covers 1 user or 100.

| Users | What changes | Monthly cost |
|---|---|---|
| 1 | nothing | **$0** |
| 10 | digests 4 → 40/month; DB still < 20 MB | **$0** |
| 100 | ~400 digests/month; DB ~100 MB; **two ceilings hit** (below) | **~$21** (Vercel Pro $20 + domain ~$1; Resend still free) |
| 1,000 | Supabase Pro $25, Vercel Pro $20, more digest volume | **~$50–70** |

**Marginal cost per user is close to zero until the ceilings, which are contractual, not technical.**

## The three ceilings

1. **Vercel Hobby is personal, non-commercial use.** That is the real limit, not the quota. The
   moment this is a product with customers, it needs Pro ($20/month). A portfolio project with a
   handful of friends is fine; a business is not. *Confirm the current wording before relying on it.*
2. **Supabase free has no automatic backups.** The Pro plan adds 7-day backups at $25/month. Our
   mitigation is structural: **Gmail keeps the source emails**, so the database can be rebuilt from
   the mailbox — losing manual edits, snoozes and dismissals, but not the applications themselves.
3. **Gmail sending reputation.** Four digests a month is nothing. Four hundred from one personal
   account, to strangers, is how accounts get flagged. The move to Resend at ~100 users is not about
   cost — it is about not being spam.

## What is deliberately absent from the bill

No LLM tokens (ADR 0004), no managed queue (ADR 0005), no error-tracking SaaS, no analytics, no
domain. Every one of those is a free-tier trap avoided rather than a cost deferred.

## The honest summary

$0 today, and $0 up to roughly ten users. The path past that costs about $21/month, and the thing
that breaks first is **Vercel's terms**, not our usage. Recorded so the ceiling is a decision rather
than a surprise.
