# CareerOS — Project Docs

Career management for students and job seekers: track applications, opportunities,
deadlines, pipeline, analytics, reminders.

The 10-stage workflow is a guide, not a rulebook. One stage at a time.

## Stage tracker

| Phase  | #   | Stage                    | Status                  | Doc                                                              |
| ------ | --- | ------------------------ | ----------------------- | ---------------------------------------------------------------- |
| THINK  | 1   | Capture the idea         | ✅ done                 | [01-capture-the-idea.md](01-capture-the-idea.md)                 |
| THINK  | 2   | Frame the problem        | ✅ done                 | [02-frame-the-problem.md](02-frame-the-problem.md)               |
| THINK  | 3   | Validate before building | ✅ GO                   | [03-validate-before-building.md](03-validate-before-building.md) |
| THINK  | 4   | Define scope             | ✅ done                 | [04-define-scope.md](04-define-scope.md)                         |
| DESIGN | 5   | Technical discovery      | ✅ done (9/9)           | [05-technical-discovery.md](05-technical-discovery.md)           |
| DESIGN | 6   | Design                   | 🟡 D3 approved, D4 next | [06-design/](06-design/README.md)                                |
| BUILD  | 7   | Foundation               | not started             | —                                                                |
| BUILD  | 8   | Plan the work            | not started             | —                                                                |
| BUILD  | 9   | Feature build loop       | not started             | —                                                                |
| BUILD  | 10  | Quality gates            | not started             | —                                                                |

## Conventions

- One doc per stage: `docs/NN-stage-name.md`. The doc holds the stage's output.
- Decisions get an ADR in `docs/adr/NNNN-title.md` from Stage 5 onward.
- The agent maintains these docs; the user is not asked to create folders or files.

## Known limitations (deliberately accepted)

- **Email ingestion runs on a polled Gmail mailbox, not a real inbound webhook** — latency ≥ 5 min,
  single point of failure, depends on Google's tolerance for automated IMAP, manual forwarding
  verification. Full list with mitigations and exit criteria:
  [ADR 0001](adr/0001-email-ingestion-imap-polling.md). Revisit when a domain exists, past ~200
  users, if Google tightens access, or if self-serve signup is wanted.
- **Nothing is always-on.** Ingest is triggered every 5 minutes by a free external scheduler; if that
  scheduler stops, ingestion stalls silently and nothing warns you. See
  [ADR 0002](adr/0002-serverless-ingest.md). Exit when latency under a minute matters or paying for
  hosting becomes acceptable.

## Working rules

1. Clear, precise, brief, on point.
2. Explanations: short, simple words.
3. Any decision: state what it is, list alternatives with strengths/weaknesses, then recommend.
4. The agent records everything the project needs — docs, ADRs, folder structure — unprompted.
5. Challenge the user's ideas rather than agreeing by default. Push back with reasons.
6. **Spikes must never become the product.** Spike code is throwaway and gets deleted; only its
   findings and rules survive. Stage 7 writes the real implementation from scratch.
