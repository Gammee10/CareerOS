## What this changes

<!-- One or two sentences. What is different for the user or the system? -->

## Design constraints touched

<!-- Tick what applies — see AGENTS.md and docs/06-design/ -->

- [ ] Module boundary (D3 arrow matrix)
- [ ] An invariant (D4.3) — which one:
- [ ] A state machine (D4.2) — which transition:
- [ ] A quality driver (D1) — which one:
- [ ] None — docs, tooling, or cosmetics

## How it is proven

<!-- The test, or the command whose output you are relying on. "It works" is not evidence. -->

## Checks

- [ ] `pnpm verify` passes locally
- [ ] New behaviour has a test; a fixed bug has a regression test with the real input
- [ ] No secrets, no email content in logs
- [ ] Migrations (if any) are additive — expand, migrate, contract
