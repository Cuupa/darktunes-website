# Agent Workflow

Rules for AI agent runs on this project. Mandatory CI sequence lives in `AGENTS.md` — run all four checks after every change; never open a PR with failures; no `as any` / `@ts-ignore` / `eslint-disable` to silence errors.

## Docs review (end of every session)

Review and update stale sections in:

| Area | Files |
|------|-------|
| Agent spec | `AGENTS.md`, `docs/agent/*.md` |
| Onboarding | `README.md`, `DEPLOYMENT.md`, `.env.example`, `scripts/vercel-install.sh` |
| Product state | `INTEGRATION-SUMMARY.md`, `ADMIN.md`, `SECURITY.md` |

Mandatory even when the task did not touch docs. New public APIs, components, or utilities → update the relevant `docs/agent/*.md` topic file (or JSDoc).

**Minimal changes:** smallest diff that fully solves the requirement; no unrelated refactors; no new dependencies unless necessary.

## Multi-agent pattern (large tasks)

For tasks with >3 distinct concerns:

1. List sub-tasks in the PR description.
2. One atomic commit per sub-task.
3. Run full CI after each commit.

Prefer separate GitHub Issues per independent module (schema → DAL → UI). Mark blocking deps explicitly. Handoff comments must list exports and schema changes for dependent agents.

## Living spec

New conventions → update the matching `docs/agent/*.md` file. New topic → add file and link from `AGENTS.md`.