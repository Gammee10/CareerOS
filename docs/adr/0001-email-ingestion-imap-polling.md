# ADR 0001 — Receive application email via a dedicated mailbox and IMAP polling

**Status:** Accepted — 2026-10-21
**Deciders:** project owner
**Supersedes:** the inbound-webhook mechanism assumed in the Stage 4 spec
**Related:** Stage 4 spec (§ "The one scope decision"), Spike 2, [principles.md](../principles.md) (ingest seam)

## Context

The v1 wedge is _near-zero-effort capture_: the user forwards application email to an address we
control, and the application records itself. The Stage 4 spec assumed an inbound webhook, which
requires **MX records on a domain we own**.

The owner does not own a domain and will not buy one soon. Without a domain, no email provider
will host an inbound address for us — this is a hard constraint, not a preference.

## Decision

Ingestion runs through a **dedicated Gmail mailbox polled over IMAP**:

- One mailbox we own: `careeros.inbox@gmail.com`.
- Per-user routing by plus-addressing: `careeros.inbox+<random-code>@gmail.com`.
- A worker polls every 60 s, fetches unseen messages, dedupes on `Message-ID`, and hands each
  message to the **same ingest adapter** a webhook would later use.
- The poller is one implementation of the adapter. It is not the architecture.

## Accepted limitations

These are known, deliberate, and must not be rediscovered as surprises later.

| #   | Limitation                                                                                                              | Severity      | Mitigation / note                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| L1  | **Latency ≥ 1 minute** (60 s poll), versus the original 30 s target                                                     | Low           | Spec NFR amended to **< 2 min p95**. Acceptable for a Monday-digest product                                            |
| L2  | **Single shared mailbox** for all users — one point of failure, one throughput ceiling                                  | High at scale | Fine to a few hundred users. Beyond that, the mailbox is the bottleneck before the app is                              |
| L3  | **Depends on Gmail tolerating automated IMAP access.** Google can throttle or break it without notice                   | High          | No contractual guarantee. Exit plan below. Monitor for auth failures daily                                             |
| L4  | **Requires a phone-verified Google account with 2FA and an app password**                                               | Medium        | One-time setup. It is an identity dependency, not just a technical one                                                 |
| L5  | **Forwarding verification is manual** — the user's Gmail sends a confirmation to our mailbox, and a human must click it | Medium        | Acceptable for a handful of users; a real blocker for self-serve signup                                                |
| L6  | **Plus-addresses are guessable in principle** — anyone who learns a code can inject mail into that user's account       | Medium        | 128-bit random codes; unknown senders land in Review, never auto-create; rate-limit per code. Recorded, not eliminated |
| L7  | **Forwarded mail can be eaten by spam filtering** before it ever reaches us                                             | Medium        | Nothing we can do on our side. Fallback is manual add or paste                                                         |
| L8  | **No delivery receipts or bounce visibility**                                                                           | Low           | Absence of mail is indistinguishable from absence of applications                                                      |
| L9  | **IMAP re-delivery is normal** — the same message can appear twice                                                      | Low           | Idempotency on `Message-ID`, already required by Stage 4                                                               |

## Consequences

- The Stage 4 spec is amended: mechanism, ingest latency (< 2 min p95), and a first-run step for
  the verification email.
- The parser is unaffected. It consumes a normalised message regardless of how it arrived.
- Cost stays at **$0** for ingestion.

## Exit criteria — when to revisit

Replace the poller with a webhook adapter when **any** of these becomes true:

1. A domain is acquired (the original plan becomes available again).
2. More than ~200 users, or ingest lag starts affecting the due list.
3. Google throttles, blocks, or changes app-password access.
4. Self-serve signup is wanted (L5 blocks it).

Replacement is additive: add a webhook adapter that emits the same normalised message, delete the
poller, keep everything downstream. If the swap needs more than that, the ingest seam was built
wrong.

## Validation (Spike 2, 2026-10-22)

Auto-forwarding through Gmail was tested end to end against a genuine third-party destination.

- The mechanism works: forwarded mail arrives in ~13 s, with the original `From`, `Message-ID`,
  `Subject` and body all preserved and no `Fwd:` prefix.
- **Routing must use `X-Forwarded-To`** (fallback: the outer `Delivered-To`). Gmail keeps the
  original `To` header on auto-forwards, so keying on `To` would collapse every user into one bucket.
- Gmail **silently refuses** to forward to an address on the sending account. Irrelevant in
  production, but it cost two hours of false negatives in testing.
- Forwarding-address verification needs a human click in a signed-in browser; a scripted GET
  returns HTTP 200 without confirming anything.
