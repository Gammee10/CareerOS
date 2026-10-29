# Spec: CareerOS v1 — "what do I owe next?"

**Stage:** 4 — Define scope
**Status:** ✅ approved (2026-10-20) — open questions resolved below
**Date:** 2026-10-20
**Carried in from Stage 3:** retrieval cost → avoidance → missed dates. The check must come to
the user; capture must be near-free; dates are optional; answers require zero searching.

---

## Goal (one sentence)

For anyone running an active job search, make the next thing they owe visible without them
having to go looking for it.

## Users

One person running their own search. No teams, no advisers, no sharing.

## The one scope decision that shapes everything

**How applications get into the system.** This is the wedge — if capture costs typing, the
product is "organised email" and loses.

| Option                                       | Strength                                                                                                       | Weakness                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A. Manual entry only                         | Trivial to build; no privacy surface                                                                           | Fails the Stage 3 finding outright; decays exactly like a spreadsheet                                  |
| B. **Forward-to-address ingestion** (chosen) | Near-zero ongoing effort; one-time auto-forward rule; no OAuth review; parsing is a bounded, learnable problem | Parsing accuracy is the main risk; needs a review queue as a safety net; hosting an inbound address    |
| C. Gmail OAuth, read the inbox               | Best UX; no setup ritual                                                                                       | Restricted scopes + Google verification; heavy consent and privacy burden; blocks a portfolio timeline |
| D. Browser extension                         | Captures at the point of applying                                                                              | Per-site work; doesn't capture replies, which is where the drops happen                                |

**Recommendation: B**, with paste-a-body as a Should-level fallback. It is the only option that
is both low-effort for the user and buildable without an approvals process. **If you reject B,
say so — most of this spec changes.**

## Main user journey (7 steps)

1. **Setup** — user gets a personal ingest address and adds one auto-forward rule in their email.
2. **Apply** — they apply somewhere, as they already do. Nothing new to do.
3. **Ingest** — the confirmation email forwards automatically; an application appears, already
   labelled with company, role, stage and date.
4. **Resolve** — anything ambiguous waits in a review queue; one tap to confirm or discard.
5. **Check** — the due list arrives on its own: a Monday digest, plus the app when they open it.
6. **Act** — mark done or snooze, one action, no forms.
7. **Update** — a later email from the same employer moves the stage forward by itself.

## In scope (v1)

- One ingest address per user; auto-forward or manual forward.
- Parsing of common application emails (confirmation, interview invite, rejection).
- A review queue for anything the parser cannot resolve.
- A single "due next 7 days" view, overdue items pinned.
- One-action complete and snooze.
- Manual add for applications that never send email.
- Monday digest email: due items + applications quiet for 14 days.
- Simple status: applied → interviewing → offer → rejected / withdrawn.

## Out of scope (not now)

- **Analytics dashboard** — no data worth analysing until people stay; week-4 retention comes first.
- **Kanban pipeline board** — a prettier view of a list; no evidence it changes behaviour.
- **Job discovery, matching, recommendations** — a different product.
- **Auto-applying / form filling** — different product, high risk, high abuse surface.
- **CV/resume builder or storage** — different product.
- **Native mobile app** — responsive web only.
- **Gmail/Outlook OAuth** — deferred with the approval burden.
- **Calendar sync, browser extension, multiple ingest addresses.**
- **Sharing, adviser view, teams, payments.**
- **Sending email from the app** on the user's behalf.

## Stories and acceptance criteria

**MoSCoW:** M = MVP. Everything below is M except where marked S.

### S1 (M): As a searcher, I want to forward an application email to one address, so that the application is recorded without typing.

- Given a forwarded email from a recognised sender containing a company and role, when it reaches
  the ingest address, then an application appears within 30 s with company, role, inferred stage
  and source date.
- Given an email the parser cannot resolve, when it arrives, then no application is created and the
  email appears in Review with sender, subject and received time.
- Edge cases: same email forwarded twice → **one** application, deduped by Message-ID; empty body →
  Review; attachment > 10 MB → accepted to Review, body not parsed; email from an unknown sender →
  Review, never auto-filed; ingest address unknown/inactive → sender gets a bounce, nothing stored.

### S2 (M): As a searcher, I want unclear emails queued for one-tap confirmation, so that capture stays effortless without creating junk.

- Given an item in Review, when I open it, then I see sender, subject and a prefilled form, and I can
  confirm, edit-then-confirm, or discard in at most two actions.
- Given I discard an item, when I return, then it is gone from Review and no application exists.
- Edge cases: 100 queued items → paginated, oldest first; confirm clicked twice → one application;
  parse service down → items queue and appear as they are processed, nothing lost.

### S3 (M): As a searcher, I want later emails from the same employer to update the existing application, so that I never get duplicates.

- Given an existing application for company X, when a later email from X arrives, then the
  application's stage and last-activity date update and the event is recorded in its history.
- Given two open roles at company X, when both receive email, then two separate applications exist.
- Edge cases: ambiguous match (same company, unclear role) → Review, never silently merged; email
  arrives for an application the user deleted → Review; stage would go backwards → keep the furthest
  stage, flag the conflict in Review.

### S4 (M): As a searcher, I want to see everything due in the next 7 days without searching, so that nothing slips.

- Given applications with a date inside 7 days, when I open the app, then they are listed by date
  with one line saying what is owed.
- Given overdue items, when I open the app, then they appear pinned above the upcoming ones.
- Given nothing due, when I open the app, then I see "nothing due this week" — an explicit empty
  state, not a blank screen.
- Edge cases: item added seconds ago → appears within 5 s; date in the past by more than 30 days →
  shown as stale, still visible.

### S5 (M): As a searcher, I want to act on an item in one gesture, so the list stays clean.

- Given a due item, when I mark it done, then it leaves the list immediately and a timestamped event
  is recorded.
- Given I snooze it, when I pick a date, then it reappears on that date and nowhere before it.
- Edge cases: double click → one event; failure to save → item stays and a clear message appears.

### S6 (M): As a searcher, I want to add an application that never emailed me, so nothing is missing.

- Given I enter only a company and a role, when I save, then the application exists with status
  "applied" and no date.
- Given an invalid date, when I save, then nothing is stored and I see a clear message.
- Edge cases: duplicate company+role → warn, allow anyway; empty form → save is disabled.

### S7 (M): As a searcher, I want a Monday email telling me what is due, so I do not have to remember to check.

- Given it is Monday 08:00 in the **user's own timezone**, when there is anything due in 7 days or
  any application quiet for 14 days, then exactly one digest email is sent.
- Given there is nothing to report, then no email is sent that week.
- Edge cases: send failure → one retry, then skip (never duplicates); user unsubscribes → no further
  digests, app still works; **DST transition week → still exactly one digest, never zero or two**;
  timezone changed mid-week → the next digest uses the new zone.

### S8 (S): As a searcher, I want to fix a wrong inference in place, so bad data does not accumulate.

## Non-functional requirements (scenarios with numbers; Template R)

- **Speed:** When a user opens the due list, it renders from cache in **< 500 ms at p95** (measured
  by server timing on the API plus client paint). When a forwarded email arrives, the application
  is visible **< 6 min at p95** (measured from mailbox arrival to row creation).
  _Amended 2026-10-22 — was `< 30 s`, then `< 2 min`; the $0 serverless architecture polls every
  5 minutes ([ADR 0002](adr/0002-serverless-ingest.md))._
- **Security and privacy:** A user may see **only their own** applications and emails. Test: request
  another user's application ID directly → **403**, and the attempt is logged. Stored personal data:
  name, email, applications, and **email subject + a 500-character snippet only** — full bodies are
  discarded after parsing. **Retention ladder:** raw message **7 days** (debug and re-parse), then
  the body is deleted; per-email snippets **30 days**, then deleted; the most recent snippet per
  application is kept while the application exists; structured fields (company, role, stage, dates)
  are kept indefinitely — they are the product data. All traffic over TLS; data encrypted at rest.
- **Reliability:** No forwarded email is ever lost — raw message is persisted **before** parsing, with
  retry (3 attempts, exponential backoff) and a dead-letter queue. No double-create: idempotency on
  Message-ID, tested by replaying the same message 10× and asserting exactly one row.
- **Recovery:** RPO **24 h**, RTO **4 h**. If the parser is down, ingest keeps accepting and rows
  appear as "pending" — the app never shows a false "nothing due" because of a parser failure.
- **Cost:** hosting **< $10/month** total at 100 users (free tiers + one paid tier if needed).
- **Devices:** one responsive web app, usable at **360 px** width; digest email readable in Gmail web
  and mobile without horizontal scroll.
- **Languages:** English only.
- **Availability:** best-effort, **99% monthly**; no SLA.

## Success measure

- **Main metric (from Stage 2):** ≥ **60% of the first 20 onboarded users** (12 people) still making
  status updates or checking the due list in **week 4** after signup.
- **Guardrail 1 — parsing quality:** **< 10%** of ingested emails land in Review and stay unresolved
  for more than 48 h.
- **Guardrail 2 — privacy:** **zero** cross-user data exposures. Any single incident is a failure.
- **Review date:** **2027-01-22** — one week after the main metric is read.

## Top risks and plans

| #   | Risk                                                                                       | Plan                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Parser accuracy** — mis-filing creates junk, which destroys trust faster than no product | Build the parser against a corpus of the author's own real emails first (Stage 5 spike). Ship narrow: 3 email types, one sender. Everything else goes to Review. Measure precision before widening. |
| 2   | **Setup friction** — the auto-forward rule is a 5-minute task a student may never do       | Offer two paths: one-click rule instructions for Gmail, and manual "forward this one email now" that works immediately. Instrument time-to-first-application; if > 3 minutes, the wedge is broken.  |
| 3   | **Inbound email reliability** — provider limits, spam filtering, deliverability            | Use a provider with a documented inbound webhook, verify with a real domain, monitor ingest failures daily, dead-letter queue from day one.                                                         |
| 4   | **Privacy of employer emails** — other people's names and data in the system               | Store snippet only, 30-day retention, single-tenant-per-user access tests, documented deletion.                                                                                                     |

## Resolved open questions (2026-10-20)

1. **Assessment deadlines are in scope.** The missed "exam" was an **application assessment**, not a
   university exam. This is one of the sharpest drop vectors there is: a fixed window, an automatic
   fail on a miss, and nobody to reschedule with. Folded into existing stories — S1 recognises an
   assessment invite, S4 renders it as a due item with a hard deadline, S3 moves the stage when the
   link arrives. **No new story was added; scope is unchanged.**
2. **Timezone: per user, yes.** Store an IANA zone, send the digest at 08:00 local. The complexity is
   not in storing it but in the two hours a year when the clock shifts — covered by the "exactly one
   digest, never zero or two" case.
3. **Retention ladder:** raw message 7 days → snippets 30 days → the latest snippet per application
   is kept while it exists → structured fields kept indefinitely.
4. **Hosting: deferred to Stage 5.** Free-tier providers only for v1 (Railway / Render / Vercel and
   equivalents); the paid path is a later question.
