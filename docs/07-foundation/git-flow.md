# Git flow

**Status:** adopted 2026-10-29 · applies from the first push to GitHub

## The rule

**`main` is always deployable.** It is the branch Vercel deploys from, so a broken merge is a broken
product. Everything reaches it through a pull request with CI green.

|                         |                                                                |
| ----------------------- | -------------------------------------------------------------- |
| Long-lived branches     | **`main` only**                                                |
| Feature branches        | created per change, deleted after merge                        |
| Direct pushes to `main` | **blocked**                                                    |
| Merge style             | **squash** — one commit per change on `main`                   |
| Required check          | `verify` (typecheck, lint, format, tests)                      |
| Review                  | self-review via the PR template; the checklist is the reviewer |

## Branches

Short-lived, named for the change, one concern each:

```
feat/walking-skeleton      a user-visible capability
fix/digest-double-send     a defect
chore/ci-workflow          tooling, no behaviour change
docs/adr-0010              documentation only
```

The prefix matches the commit type, so the history reads consistently. A branch that lives more than
a few days is a branch that will conflict — split it.

## Commits

Conventional Commits, because they are machine-readable and the history becomes a changelog:

```
feat(intake): parse greenhouse rejection emails
fix(delivery): do not send twice when the sending window expires
docs(adr): record the at-least-once digest decision
chore(ci): run verify on every pull request
```

The scope is the module (`intake`, `ledger`, `planning`, `delivery`) or an area (`ci`, `docs`,
`db`). One logical change per commit.

## Pull requests

Small, and they answer three questions:

1. What does this change, and why?
2. Which design constraint does it touch (a module boundary, an invariant, a driver)?
3. What test proves it?

The template is in [`.github/pull_request_template.md`](../.github/pull_request_template.md). The
merge button is enabled by CI passing, not by the author feeling confident.

## Protecting `main`

Applied once the repository is on GitHub, with a token scoped to the repo:

```bash
# required status check + no direct pushes
curl -sS -X PUT \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/Gammee10/CareerOS/branches/main/protection" \
  -d '{
    "required_status_checks": { "strict": true, "contexts": ["verify"] },
    "enforce_admins": true,
    "required_pull_request_reviews": { "required_approving_review_count": 0 },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'
```

`enforce_admins: true` is the part that matters for a solo project — without it, the rule applies
only to everybody who is not you, which is nobody.

**Approving reviews are 0 on purpose.** A solo project cannot review its own PR; pretending otherwise
would mean rubber-stamping. The required status check is the real gate.

## When the rules bend

| Situation                     | Allowed                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Hotfix while `main` is broken | Branch, fix, PR, merge — no shortcut. The pipeline is fastest when nothing bypasses it     |
| Docs typo                     | Still a PR; it costs 40 seconds                                                            |
| Experiment                    | `.tmp/`, never `main`                                                                      |
| Machine without hooks or pnpm | `git commit --no-verify`, then `pnpm verify` before pushing — the CI gate still catches it |

## What this does not do

No release branches, no versioning scheme, no `develop` branch, no tags. There is one product, one
deployment, and one user. Release ceremony would be a costume.
