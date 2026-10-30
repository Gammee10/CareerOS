# RB8 — Site down (uptime alert)

**Symptom.** UptimeRobot emails that `https://career-os-green-two.vercel.app/api/health` is down. This
is the only alert that arrives without you looking, so it gets the most careful triage.

**Check — in this order.**

1. Open `/api/health` yourself. What you see decides everything:

| What you see                     | Meaning                                                             | Go to                              |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| **503** `dependency_unavailable` | App is fine, database is not                                        | [RB4](rb4-database-unreachable.md) |
| **200 but an HTML login page**   | Vercel deployment protection was re-enabled; the app is unreachable | Below                              |
| **404 / 500 from Vercel**        | Build or routing problem                                            | 3                                  |
| **Timeout / no response**        | Vercel or the network                                               | 3                                  |

2. **HTML instead of JSON:** Vercel project settings → Deployment Protection → disable it. New projects
   enable it by default and it returns **HTTP 200**, which is why the monitor checks the keyword
   `"ok":true` and not just the status code.
3. **Vercel:** does the latest deployment show READY? A failed build means the last merge broke the
   build — roll back to the previous deployment, then fix forward.
4. **Everything looks fine but the monitor still says down:** refresh the monitor; a single failed
   check is not an outage. Look at its history for the duration.

**Action.** Fix the cause, then confirm the monitor returns to UP by itself. Do not pause it to make
the alert stop — that converts a known failure into an unknown one.

**Escalate.** Vercel status page for a platform outage; otherwise none.
