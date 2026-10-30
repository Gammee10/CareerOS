# RB4 — Database unreachable

**Symptom.** `/api/health` returns **503** with `dependency_unavailable`. UptimeRobot alerts. Every
page that needs data fails; the app itself is fine.

**Check.**

1. Supabase dashboard → project status. The free tier **pauses projects after a week of inactivity** —
   which never happens while ingestion runs, but does the moment it stops.
2. Project not paused but still failing: check the usage page for quota, and whether the connection
   string in Vercel still matches the project (a project restore can change the pooler host).

**Action.**

- **Paused:** resume it in the dashboard. No data is lost; the app recovers on the next request.
- **String changed:** update `DATABASE_URL` in Vercel and redeploy.
- **Quota exceeded:** the free tier limit is 500 MB; we are at a few megabytes. If this is the cause,
  something is wrong elsewhere — investigate before upgrading.

**Escalate.** Supabase support (community forum) if the project will not resume.

**Never** drop and recreate the database as a first move: the backup export is the only copy of
anything the user typed.
