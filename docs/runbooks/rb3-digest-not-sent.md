# RB3 — Digest not sent

**Symptom.** Monday passed with no digest email. It is after 14:00 local and no `digests` row exists
for the current ISO week.

**Check.**

1. Is there a `digests` row at all? `sent` means we sent it — check Gmail's Sent folder before
   blaming the app. `sending` for more than 10 minutes means a crash mid-send.
2. No row: the digest trigger did not fire, or it fired and found nothing to say (an empty week sends
   nothing, by design — that is not a failure).
3. Is `DIGEST_PAUSED=true` in Vercel? That switch exists precisely to stop sends.

**Action.**

- **Stuck in `sending`:** the recovery path marks it `failed` after 10 minutes; one retry is allowed
  inside the 6-hour catch-up window. Wait for the next hourly run rather than forcing a send.
- **No row and it is within 6 hours of 08:00:** wait — the catch-up window is the mechanism.
- **Outside the window:** accept the missed week, and check why the trigger never fired (RB5). Do not
  hand-send: the unique key exists to prevent exactly that duplication.

**Escalate.** None.
