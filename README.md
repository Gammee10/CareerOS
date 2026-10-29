# CareerOS

**Your career search, organised.** Forward your application emails, and CareerOS tells you where each
application stands and what you owe next — before a deadline slips past.

> **Status: foundation in progress.** The design is complete (see [`docs/`](docs/README.md)); there is
> no runnable app yet. This README describes the target state and is being made true one step at a
> time. Anything not yet built is marked as such.

## What it does

- **Records applications without typing.** One forwarding rule in Gmail; application mail arrives, is
  parsed, and becomes an application with a company, a role and a stage.
- **Queues what it cannot read.** An unclear email goes to a Review list instead of being guessed at.
  A blank field is better than a plausible wrong one.
- **Answers "what do I owe next?"** A due list of the next seven days, with overdue items pinned — no
  searching, no scrolling through email.
- **Comes to you.** One digest email on Monday at 08:00 in your timezone.

## How it works

1. You add a filter in Gmail that forwards application mail to a private address.
2. Every 5 minutes, a scheduled trigger calls `/api/ingest`, which reads new mail over IMAP, parses
   it, and records the result.
3. Anything below the confidence threshold lands in **Review**, one tap to confirm or discard.
4. The app shows what is due; completing or snoozing takes one action.
5. Monday morning, `/api/digest` composes one email — exactly one per week, guaranteed by a database
   key rather than a timer.

## Shape

Four modules with one-way dependencies — `intake → ledger ← planning ← delivery` — deployed as
serverless functions, with Postgres as both the record and the work queue.

- **Hosting:** Vercel, `dub1` (the same region as the database — measured at 1.7 s per ingest versus
  13.6 s from elsewhere)
- **Data and auth:** Supabase Postgres + Auth, `eu-west-1`
- **Mail:** Gmail (IMAP in, SMTP out)
- **Trigger:** a free external scheduler, every 5 minutes
- **No always-on process anywhere**

Architecture decisions live in [`docs/adr/`](docs/adr/); the reasoning is in
[`docs/06-design/`](docs/06-design/README.md).

## Repository layout

```
docs/        design pack, ADRs, runbooks, stage-by-stage record
src/         application code                        (arrives with the walking skeleton)
scripts/     migrations and operator tools           (arrives with the walking skeleton)
```

## Requirements

- **Node 22+** (see `.nvmrc`)
- **pnpm 11** — `corepack enable` is the simplest way to get the right version
- Windows note: this repo sets `nodeLinker: hoisted` in `pnpm-workspace.yaml`. pnpm's default
  junction-based layout is unreadable to Node's module resolver in sandboxed or synchronised
  folders (OneDrive), which breaks nested dependencies. Hoisted uses real directories instead.

## Commands

```
pnpm install        # install dependencies
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint, zero warnings allowed
pnpm format         # prettier --write
pnpm test           # unit tests (vitest)
pnpm verify         # all of the above, in order — run this before pushing
```

Pre-commit hooks run `lint-staged` on the staged files only. Enable them once with:

```
pnpm hooks          # git config core.hooksPath .husky
```

## Constraints (deliberate)

| Constraint              | Why                                                                |
| ----------------------- | ------------------------------------------------------------------ |
| **$0 hosting**          | Vercel Hobby + Supabase Free; the architecture was chosen to fit   |
| **No always-on server** | Serverless functions plus a free scheduler                         |
| **No LLM**              | Rules are testable, private, and free; unclear mail goes to Review |
| **One user**            | Multi-user is a column (`owner_id`) away, not a redesign           |

## Not in v1

Analytics dashboard · Kanban pipeline · job discovery · auto-apply · CV builder · native mobile app ·
Gmail OAuth · calendar sync · team or adviser views · payments.

Each has a written reason in [`docs/04-define-scope.md`](docs/04-define-scope.md).
