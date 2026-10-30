# RB7 — Backup failing

**Symptom.** No `export` run for more than 24 hours. `job_runs` shows nothing, or `outcome = 'failed'`.

**Check.** The export job's error, the Supabase Storage bucket (does it exist, is it private, is the
project quota full), and whether the scheduler still calls `/api/export`.

**Action.** Fix the cause, then run the export manually. **Then restore from the latest export once**,
into a scratch project — the only proof that a backup works.

**Escalate.** None.

**Why this matters more than it looks.** The free tier has no automatic backups (ADR 0001, R4). The
nightly export is the only copy of anything the user _typed_ — statuses, snoozes, corrections. The
database itself is rebuildable from Gmail; the edits are not.

**Rotation.** Seven files. A failure that lasts longer than seven days means the oldest good backup
has already been deleted — treat that as data loss, not a delay.
