# RB6 — Mailbox account disabled

**Symptom.** IMAP authentication fails repeatedly and a **new app password does not fix it**. Both
ingestion _and_ the digest stop, because they share one credential (recorded in ADR 0001).

**Check.** Can you sign in to the mailbox in a browser? If not, the account is restricted or disabled
— this is the R2 scenario, and there is no technical mitigation.

**Action.**

1. Attempt Google account recovery first — that keeps the address, the forward rule, and the history.
2. If that fails: provision a new mailbox, update `MAIL_IMAP_USER`, `MAIL_IMAP_PASSWORD`,
   `MAIL_SMTP_USER`, `MAIL_SMTP_PASSWORD` in Vercel, and **re-point the user's Gmail forward** to the
   new address.
3. Nothing in the database needs to change: the address is not stored per user in v1.

**Escalate.** Google account recovery. If that fails, this is a product-level incident — the capture
mechanism is unavailable until a domain and a real inbound provider exist (ADR 0001 exit criteria).

**Do not** paste the app password into a chat, an issue, or a commit while debugging.
