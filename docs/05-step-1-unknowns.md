# Stage 5 · Step 1 — Unknowns

**Status:** ✅ approved (2026-10-20)
**Output:** a ranked register of what we do not know, and a spike order.

Ranked by *would this change the design if the answer is bad*, not by novelty.

## Would kill the product

| ID | Unknown | Why it matters if bad | How to resolve |
|---|---|---|---|
| **U1** | Do real application emails actually contain a usable **date or next action**? | If most emails are pure information, the due list is empty and the product collapses into a record — the thing Stage 3 ruled out | No code: read the last 15 application emails and count |
| **U2** | What do emails from different ATS platforms look like (Greenhouse, Lever, Workday, SmartRecruiters, LinkedIn, direct)? | If every employer formats differently, a narrow parser never covers enough to feel useful | Sample 10–15 real emails; cluster by sender domain and template |
| **U3** | Can a rule-based parser hit acceptable precision, or is an LLM required? | An LLM adds cost, latency, a privacy transfer of email content, and a new failure mode | Spike 3: build against the corpus, measure precision and recall by hand |

## Would kill the architecture

| ID | Unknown | Why it matters if bad | How to resolve |
|---|---|---|---|
| **U4** | Can a free-tier stack receive **inbound email** to a custom domain and POST a webhook? | The approved capture mechanism does not exist; the spec changes | Spike 2: one provider, one domain, one forwarded email, end to end |
| **U5** | Can it run a job at 08:00 in a user's timezone, reliably, through DST? | The Monday digest is a Must story and may be unimplementable | Spike 4: schedule a job, force a DST transition, assert exactly one send |
| **U6** | Do free tiers sleep or scale to zero in a way that breaks the 30 s ingest target? | Late or lost emails; NFR fails | Spike 4: measure cold vs warm webhook latency |
| **U7** | Is there a durable queue available without paying? | Persist-before-parse, retries and a dead-letter queue must be hand-rolled otherwise | Spike 5: DB-backed queue table plus worker |

## Ordinary unknowns

| ID | Unknown | Note |
|---|---|---|
| U8 | Auth: build or buy (Clerk / Supabase Auth / Auth.js) | Magic-link deliverability matters more than features |
| U9 | Outbound email provider and domain reputation (SPF/DKIM) for the digest | Resend or Postmark free tier; test delivery into Gmail |
| U10 | Free Postgres limits, connection pooling, backup/PITR | The 24 h RPO must be achievable on a free tier |
| U11 | Custom domain and TLS on the chosen host | The domain is a real cost, ~$12/year |
| U12 | Total running cost against the <$10/month target | Stack the free tiers; include domain, mail, any LLM use |
| U13 | Legal and privacy: third-party PII in forwarded mail; provider ToS | Retention ladder is already decided; confirm terms permit it |
| U14 | Team size, deadline, budget as hard constraints | Assumed: one builder, part-time, portfolio timeline |

## The one that worries me most

**U1.** Everything else can be engineered around. If application emails do not carry dates, there is
no "due next" to show, and we are building a record-keeper that loses to a spreadsheet — the exact
outcome Stage 3 ruled out. It is also the cheapest to answer: read fifteen emails and count.

## Spike order

| # | Spike | Box |
|---|---|---|
| 1 | U1 + U2 — corpus read, no code | 1 h |
| 2 | U4 — inbound email end to end | 1 day |
| 3 | U3 — parser precision on the real corpus | 1 day |
| 4 | U5 + U6 — scheduler and cold-start latency | 1 day |
| 5 | U7 — DB-backed queue on the free tier | 0.5 day |
