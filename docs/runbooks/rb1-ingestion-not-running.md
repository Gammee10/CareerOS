# RB1 — Ingestion not running

**Symptom.** No new applications have appeared for hours. The status page (when it exists) shows the
last ingest run older than 30 minutes; eventually the app banner turns red.

**Check.**

1. Open `/api/health`. `200` + `"ok":true` means the app and database are fine — the problem is the
   trigger, not the app.
2. In the scheduler (cron-job.org), is the ingest job still active? Check its run history for failures.
3. Call `/api/ingest` by hand with the bearer token. `200` and a run recorded = the endpoint works and
   the scheduler is the problem (RB5).

**Action.** Re-enable or recreate the scheduler job. If the token rotated, update both sides — the
scheduler's header and Vercel's `CRON_SECRET`. **Nothing is lost:** mail waits in the Gmail mailbox
and the next successful run picks it up.

**Escalate.** None.
