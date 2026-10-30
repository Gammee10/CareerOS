# RB2 — Ingestion running but failing

**Symptom.** `job_runs` shows `outcome = 'failed'` repeatedly, with the same error. Runs are
happening — the work is not succeeding.

**Check.** The `error` column of the most recent failed run, and the corresponding log line. Two
shapes cover almost everything:

| Error looks like                              | Meaning                                        | Go to                          |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------ |
| `Invalid credentials`, `AUTHENTICATIONFAILED` | The Gmail app password was revoked or replaced | [RB6](rb6-mailbox-disabled.md) |
| A parse exception on one specific message     | One weird email, not a broken system           | Below                          |

**Action.**

- **Auth failure:** generate a new app password, update `MAIL_IMAP_PASSWORD` in Vercel, redeploy.
- **Poison message:** do nothing. The queue retries three times and then moves it to `dead`, which is
  visible. Fix the parser later against the stored row — do not let one email block ingestion.

**Escalate.** None.
