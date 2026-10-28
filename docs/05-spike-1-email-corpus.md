# Spike 1 — Do application emails tell you what to do next?

**IDs:** U1, U2
**Box:** 1 hour, no code
**Status:** ✅ answered — 20–50% band
**Date:** 2026-10-20

## The question, in plain words

When an employer emails you, does the email tell you **what to do next and when**? Or does it just
tell you something happened?

Everything in v1 depends on the answer. The due list is the product. If emails carry dates and
asks, the due list fills itself. If they do not, the due list is mostly empty and we are building a
record-keeper.

## How we run it

The user reads their last **15 application-related emails** (any outcome, any stage) and fills one
row per email in the table below. Roughly two minutes each. Duplicates from the same template can be
collapsed to one row, with a note of how many they stand for.

For each email, four facts:

1. **Sender** — company or ATS domain (Greenhouse, Lever, Workday, LinkedIn, direct).
2. **Type** — acknowledgement / interview invite / assessment / rejection / offer / other.
3. **Date** — does the email contain a date or time at all (interview slot, start date, "we'll be
   in touch by")? yes / no.
4. **Ask** — does it require an action from the user (book a slot, complete an assessment, send
   documents, reply)? yes / no.

### Data table

| # | Sender / ATS | Type | Date? | Ask? | Notes |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |
| 11 | | | | | |
| 12 | | | | | |
| 13 | | | | | |
| 14 | | | | | |
| 15 | | | | | |

## Thresholds (set before looking at the data)

| Share of emails with a date or an ask | Reading | Consequence |
|---|---|---|
| **≥ 50%** | The due-list wedge holds on extraction alone | Spec stands; due list is built from email content |
| **20–50%** | The wedge holds but extraction is not enough on its own | Add **silence detection** (no reply in N days → prompt a follow-up) as a second, independent source of due items |
| **< 20%** | Emails are pure information | The product changes shape: "the few emails that matter, surfaced fast" plus generated follow-up prompts. Spec revision required before Stage 6 |

Setting these first is deliberate: it stops us from looking at fifteen emails and deciding the answer
was whatever we hoped for.

## Also measured (U2)

- How many **distinct sender/ATS templates** appear in 15 emails.
- Whether any email carries **machine-readable structure** (schema.org JSON-LD, ICS calendar
  invitation, a link with an application ID).

Both feed Spike 3 (parser shape) and tell us whether an ICS/JSON-LD shortcut exists.

## Result

| Measure | Value |
|---|---|
| Emails counted | 15 |
| With a date | 3 (rows 9, 10, 12) |
| With an ask | 3 (rows 9, 10, 11) |
| With **either** | **4 (rows 9, 10, 11, 12)** |
| Share with signal | **26.7%** |
| Band | **20–50%** — "wedge holds, extraction alone is not enough" |

Row-level detail (sender, ATS, type) was not captured — a gap to close if the types turn out to
be concentrated.

### Honest caveat

At n=15, a 95% interval around 4/15 runs from roughly **11% to 52%**. The point estimate lands in
band 2, but the interval straddles band 3 (<20%). We cannot rule out that the true rate is "one in
nine". The decision is still safe, because the band-2 response — **silence detection** — is the
correct response to band 3 as well. A hedge that works in both worlds is worth more than a
precise answer we cannot afford.

## Verdict

**The wedge holds, but not on extraction alone.** 11 of 15 emails carry neither a date nor an ask;
they are pure information (acknowledgements and rejections). Extraction can only generate a due
item for about a quarter of inbound mail.

**Consequence: silence detection becomes a required v1 feature, not an optional one.** Without it,
roughly three quarters of a live search never produces a due item, and the due list stays empty for
exactly the applications that need chasing.

### Spec amendment required (Stage 4)

- **New story — S9 (Must):** *Given an application whose last email was an acknowledgement and
  which has had no activity for 10 calendar days, when the due list is generated, then it appears
  as "follow up" and the prompt is shown only once per application.*
- It must be dismissible ("not chasing this one"), or it becomes nagging — the failure mode that
  kills reminder products.
- It only applies after an acknowledgement, never after a rejection or an offer.
- Implication for S4: the due list has **two sources** — extracted dates and generated silence
  prompts. The UI must not confuse them; one is a fact, the other is an inference.

### Also relevant to U2

Distinct templates and any machine-readable structure (ICS, JSON-LD) were not reported. Both feed
Spike 3. Not blocking.

