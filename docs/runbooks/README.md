# Runbooks

One file per failure. Each answers the same four questions: **what you see**, **what to check**,
**what to do**, **who to escalate to** (usually nobody — this is a one-person product).

They exist because the person reading them at 3 a.m. will not remember the design.

## Which one do I need?

| What happened                                                | Read                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| Email from UptimeRobot: the site is down                     | [RB8 — site down](rb8-site-down.md)                         |
| `/api/health` returns 503                                    | [RB4 — database unreachable](rb4-database-unreachable.md)   |
| No application has been recorded for hours, page looks stale | [RB1 — ingestion not running](rb1-ingestion-not-running.md) |
| `job_runs` shows ingest failing repeatedly                   | [RB2 — ingestion failing](rb2-ingestion-failing.md)         |
| No Monday digest arrived                                     | [RB3 — digest not sent](rb3-digest-not-sent.md)             |
| Site is stale and the scheduler looks healthy                | [RB5 — scheduler dead](rb5-scheduler-dead.md)               |
| IMAP authentication failures                                 | [RB6 — mailbox disabled](rb6-mailbox-disabled.md)           |
| No nightly export for more than a day                        | [RB7 — backup failing](rb7-backup-failing.md)               |

## The rule that applies to all of them

**Do not guess.** If a runbook does not explain it, the answer is in `/api/health`, `job_runs`, or the
Vercel deployment list — in that order. Write down what you found before changing anything, so the
next incident starts from facts.

The design behind these is in [D6](../06-design/d6-operate.md).
