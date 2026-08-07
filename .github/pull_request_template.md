# Pull Request

## What changed?

Describe what this PR does (1–2 sentences):

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation only
- [ ] Refactor (no product behavior change)
- [ ] Performance / CI / tooling

## Code areas touched

- [ ] App routes (`app/*`, not API)
- [ ] API routes (`app/api/*`)
- [ ] Database schema (`supabase/reset.sql`, `src/types/database.ts`)
- [ ] Components (`src/components/*`)
- [ ] Lib / DAL (`src/lib/*`)
- [ ] Tests (`tests/*`)
- [ ] Tooling / CI (`.github/*`, `scripts/*`, `package.json`)

## Documentation

Update only what applies — see `docs/agent/workflow.md` (do not no-op edit docs to “satisfy” a checkbox).

| Doc | When required | Done |
|-----|---------------|------|
| `CHANGELOG.md` `[Unreleased]` | User-facing, API/route, security, or breaking change | [ ] |
| `docs/agent/*.md` | New or changed agent patterns / contracts | [ ] |
| `QA_CHECKLIST.md` | New or changed user-testable flows | [ ] |
| `LESSONS_LEARNED.md` | Recurring anti-pattern or process gap | [ ] |
| `README.md` / `DEPLOYMENT.md` | Setup, scripts, env, deploy changed | [ ] |
| `SECURITY.md` | Security implications | [ ] |
| `AGENTS.md` | Top-level agent rules changed | [ ] |

**Which docs did you update?** (list files/sections, or “n/a — refactor only”)

## Quality checks

- [ ] `npm run ci` passes (contracts → typecheck → tests+build)
- [ ] `npm run test:e2e` if user-facing flows changed (or note why skipped)
- [ ] Public UI: keyboard nav + basic a11y sanity
- [ ] No `as any` / `@ts-ignore` / `eslint-disable` to silence CI

**If any check failed or was skipped, why is that acceptable?**

## Lessons for next agent (optional)

What should the next agent know about this area of the codebase?
