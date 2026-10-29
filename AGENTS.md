# AGENTS.md

CareerOS — a personal job-search tracker. Forward application emails; it records them, shows what is
due next, and sends one Monday digest.

**Read first:** [`docs/06-design/README.md`](docs/06-design/README.md) (the design pack) and
[`docs/adr/`](docs/adr/) (why things are the way they are). Then the module you are touching.

## Commands

```
pnpm install     # dependencies (uses a hoisted linker — see Gotchas)
pnpm verify      # typecheck + lint + format check + tests. Run this before claiming done.
pnpm test        # unit tests only
pnpm lint        # eslint, zero warnings allowed
pnpm typecheck   # tsc --noEmit
pnpm format      # prettier --write
```

## Shape

Four modules under `src/modules/`, one-way dependencies only:

```
intake → ledger ← planning ← delivery
```

- `intake` — mailbox to recorded application (IMAP, parsing, review queue, retention)
- `ledger` — applications and their event history
- `planning` — what is due, snoozes, the silence rule
- `delivery` — the weekly digest

**Routes and pages sit above all four** and may call any of them. A module may never call a page.

## Rules

1. **Ask before adding a dependency.** Each one is a permanent liability.
2. **Never touch another module's tables.** Call its public functions.
3. **Never commit secrets.** `.secrets/` is git-ignored; configuration comes from environment
   variables. Never log email bodies, subjects, or addresses.
4. **No external call inside a database transaction.** Claim in a transaction, do the slow thing
   outside it, record the result in another.
5. **Every mutation writes exactly one event, in the same transaction.** Only `ledger` writes
   `applications` and `events`.
6. **`owner_id` on every query.** A query without it is a bug, even when there is one user.
7. **Time:** store `timestamptz` in UTC; store timezones as IANA names (`Africa/Nairobi`), never
   offsets. Date-only facts use `due_date`; instants use `due_at`.
8. **Migrations are additive** — expand, migrate, contract. Never rename or drop in one step.
9. **Every state transition gets a test.** Every fixed bug gets a regression test with the real input.
10. **Spike code stays in `.tmp/`** and never becomes `src/`. `src/` is written from the design.

## Style

- TypeScript strict. No `any`; use `unknown` and narrow it.
- Small pure functions; push I/O to the edges.
- Throw `AppError` from `src/lib/errors.ts` — never a bare string or a raw `Error`.
- Tests live beside the code: `foo.ts` → `foo.test.ts`.

## Gotchas

- **`nodeLinker: hoisted` in `pnpm-workspace.yaml` is deliberate.** pnpm's default junction layout is
  unreadable to Node's resolver in this synced Windows folder, which silently breaks nested
  dependencies. Do not "fix" it back.
- **Vitest spawns esbuild**, so it fails with `EPERM` in sandboxes that forbid subprocess pipes. That
  is the environment, not the code.
- **Git hooks cannot run** in the same restricted environments; use `--no-verify` there and run
  `pnpm verify` manually.

## Keep this file short

If it grows past ~100 lines it stops being read. Detail belongs in `docs/`, rules that matter belong
here.
