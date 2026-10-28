# Spike 2 — Can we receive email at all?

**IDs:** U4
**Box:** 1 day
**Status:** 🟡 approved — mechanism decided in [ADR 0001](adr/0001-email-ingestion-imap-polling.md); awaiting mailbox credentials
**Date:** 2026-10-21

## The question

Can an email sent to an address **we control** reach our application automatically, with the
original sender intact, for free?

## The constraint that broke the plan

Inbound email needs **MX records on a domain**. That is the whole reason the Stage 4 spec said
"a domain you own". Postmark's inbound documentation assumes the same: you configure an inbound
domain and point its MX at them ([Postmark docs](https://postmarkapp.com/developer/user-guide/inbound/inbound-domain-forwarding)).
No domain, no MX, no provider-hosted inbound address.

So the mechanism must change, or the domain must appear. The user has ruled out buying one soon.

## What a domain actually bought us

Only three things, and it is worth separating them:

1. **An address to forward to.** Any mailbox would do.
2. **A push webhook** when mail arrives. A **poll** would also do.
3. **A professional-looking address** (`@in.careeros.app`). Cosmetic, and the only one we lose.

## Options

| Option | Strength | Weakness |
|---|---|---|
| **A. Dedicated Gmail mailbox + IMAP polling** (recommended) | $0, no domain, works today; per-user routing via plus-addressing (`careeros.inbox+<code>@gmail.com`); same UX for the user as the domain plan; one credential we own, not the user's | Polling latency ≥ 1 min; Gmail app password needs a dedicated account with 2FA; Google could tighten automated access; Gmail forwarding verification email must be completed by us |
| B. Free subdomain with MX (is-a.dev, pntr.dev, etc.) + inbound webhook | Real push webhooks; verification email can be auto-handled; closest to the original design | Depends on a volunteer-run free subdomain; approval delays; can vanish; more DNS moving parts |
| C. Drop email capture in v1 — paste the email body | Simplest to build; no credentials, no polling, no ToS questions | Kills the near-zero-effort wedge; user pays the cost on every application; the thing Stage 3 said would make this lose |
| D. Gmail OAuth | No setup ritual for the user | Restricted-scope verification or 7-day refresh tokens in testing mode; far too heavy for this timeline |

**Recommendation: A.** It preserves the user-facing behaviour, costs nothing, and requires nobody's
permission. The lost pieces are latency and a pretty address — both recoverable later without
touching the parser, because ingestion sits behind an adapter.

## Why A is not as hacky as it sounds

Reading a mailbox you own over IMAP is a supported, documented use of the protocol. Many real
products started with exactly this. The adapter shape means the day a domain exists, we add a
webhook adapter beside it and delete the poller.

## What changes in Stage 4 (spec amendment)

- **Mechanism:** "forward to a unique address" becomes "forward to a plus-address on a dedicated
  mailbox; a worker polls it".
- **NFR, ingest latency:** `application visible < 30 s p95` becomes **`< 2 minutes p95`** (poll
  interval 60 s).
- **Setup:** the user's Gmail forwarding verification email arrives in our mailbox; the first-run
  flow must surface it and let the operator confirm once. For a handful of users this is manual and
  acceptable; it is a known scaling limit.
- **Reliability:** polling must be idempotent — Gmail's IMAP fetch can re-deliver; dedupe on
  `Message-ID`, same as before.

## The spike plan (when approved)

1. Create a dedicated mailbox (user action: ~2 minutes, needs phone verification; enable 2FA;
   generate an app password).
2. Small script: connect over IMAP, fetch unseen mail, print sender / subject / `Message-ID` /
   `+suffix`, mark as seen.
3. From a normal Gmail account, forward one real application email to
   `careeros.inbox+test@gmail.com`.
4. Measure: **does it arrive**, **how long**, **is the original sender preserved**, **does the
   plus-suffix survive**, **does the body survive**.
5. Repeat once with an auto-forward filter (the real user path) to confirm forwarding actually
   works end to end, including verification.
6. Delete the script.

**Pass condition:** all four of arrival, sender preservation, suffix routing, body survival — and
latency ≤ 2 minutes.

**Also checked (limitation L6):** send from an unrelated address to a known plus-code — the message
must be received but must **not** auto-create an application. Unknown senders only ever reach Review.

## Result

### Phase A — IMAP login: **PASS**

- 16-character app password accepted over IMAP4-SSL on `imap.gmail.com:993`.
- 9 folders visible, INBOX readable, 127 messages present before the test.
- **IMAP is enabled** — no toggle was needed (Google has simplified that settings page).

### Phase B — **INVALID, corrected 2026-10-21**

The message tested was **not forwarded**. The user copied the saved text of a Greenhouse
acknowledgement and sent it as a **new message** from their personal Gmail to
`gammee1018+test1@gmail.com`. A new message necessarily has the composer as its `From`, so:

- "original sender lost" is **not a finding about forwarding** — it is what composing a new
  message does. The conclusion is withdrawn.
- "original Message-ID lost" is likewise an artefact of composing, not of forwarding.

What the test *does* establish, and still holds:

| Measure | Result |
|---|---|
| Delivery to a plus-address | **Yes, within ~1 minute** |
| Plus-code arrives intact in `To` | **Yes** — code `test1` |
| Body text arrives intact | **Yes** |
| Non-plus mail is distinguishable | **Yes** — Google security alerts carry no plus-code, a clean "ignore" rule |

The remaining question — whether Gmail's **automatic** forwarding preserves the original `From`,
`Message-ID` and thread — is untouched and must be tested with a genuine forward.

### Phase B2 — real envelope test with synthetic mail

The user no longer has access to the real employer emails they analysed in Spike 1, so a genuine
employer message cannot be used. The envelope question does not need one: **any** message can test
whether forwarding preserves the original headers.

Plan: send a synthetic message from the project mailbox (`gammee1018`) to the user's personal
account (`gammee1000`), where the sender and forwarder are **different accounts**. The user's filter
forwards it to `gammee1018+test2@gmail.com`. If `From` arrives as `gammee1018@gmail.com` rather than
`gammee1000@gmail.com`, the envelope survived.

### Phase C — filter-based auto-forward: **PASS**

Two earlier attempts failed silently: forwarding to `gammee1018+test2@gmail.com` (an address on the
**same account as the original sender**) produced nothing, at both filter level and account level.
The fix was a genuine third party — a disposable mailbox at `careerosw3ne0ae1@maxxspace.com`.

Result, from the raw source of the forwarded message:

| Measure | Result |
|---|---|
| Delivered | **Yes, ~13 seconds** |
| Original `From` | **Preserved** — `gammee1018@gmail.com` |
| Original `Message-ID` | **Preserved exactly** — `<spike-g-cea1575399c1@careeros-test.local>` |
| Subject | **Preserved**, with **no `Fwd:` prefix** |
| `To` | **Original recipient** (`gammee1000`) — *not* the forwarding address |
| Routing key | **`X-Forwarded-To: <destination>`** present, plus a second `Delivered-To:` |
| Envelope | `Return-Path: gammee1000+caf_=<destination>@gmail.com` |
| Body | Intact, no added quoting |

**The decisive design consequence:** Gmail auto-forwarding **keeps the original `To` header**. If we
had routed users by the address in `To`, every forward would have been misrouted into a single
bucket. Routing must key on **`X-Forwarded-To`** (and `Delivered-To` as a fallback), which carries the
plus-code exactly as intended. This single detail justified the whole spike.

**Second consequence:** manual forwarding (Phase B2) destroys `From` and `Message-ID`; automatic
filter-forwarding preserves both. The product must therefore make the filter the primary path, and
treat "forward one email by hand" as a degraded fallback with weaker provenance.

### Verdict — **PASS**

Inbound capture is viable on a free, domainless stack:

- IMAP login and polling: works.
- Auto-forwarding preserves sender, Message-ID, subject and body.
- Routing by `X-Forwarded-To` isolates each user.
- End-to-end latency is seconds, comfortably inside the `< 2 min p95` spec.

**Known limits, now evidenced rather than guessed:**

- Gmail **will not forward to an address on the sending account** — silent drop, no error. Harmless
  in production (users forward to our mailbox), but it invalidated two hours of testing.
- Verification of a forwarding address requires a human click in a signed-in browser; a scripted
  GET returns HTTP 200 without confirming.
- A user must accept "forward all matching mail to a third party" — the trust cost of the mechanism.



