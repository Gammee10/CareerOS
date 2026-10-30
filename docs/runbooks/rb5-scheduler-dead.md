# RB5 — Scheduler dead

**Symptom.** Identical to [RB1](rb1-ingestion-not-running.md) — and that is deliberate. From inside
the application, "the scheduler never called" and "the scheduler called and we failed" are not
distinguishable. You only find out from the outside.

**Check.**

1. cron-job.org dashboard: is the job enabled? Does its history show recent successful runs?
2. If the job shows runs but `job_runs` in the database shows nothing, the calls are being rejected —
   most likely a token mismatch (401) or the deployment URL changed.

**Action.** Recreate the job with the current URL and `CRON_SECRET`. Consider the **second
independent scheduler** (D1 R1 mitigation): two free schedulers calling the same endpoint cost one
wasted run, because ingestion is idempotent per message.

**Escalate.** None.

**Prevention.** The uptime monitor catches "site down", not "site stale". The freshness banner (D1.6)
is the only thing that will make this visible from inside the app — it arrives with ingestion.
