# Agent Workflow

These rules apply specifically to AI agent runs on this project.

## CI self-healing (mandatory)

After every code change, the agent MUST run
the full local check suite and iterate until ALL commands exit with code 0.
Never open a pull request while any check is still failing.

Check sequence (run ALL in order after every fix, then restart from step 1):
  1. `npm run lint`       — ESLint: read ALL errors before fixing any. Fix all, then re-run.
  2. `npx tsc --noEmit`  — TypeScript strict check: fix all type errors. No `any` shortcuts.
  3. `npm test`           — Vitest: all unit tests must pass green.
  4. `npm run build`      — Next.js production build: fix all build errors.

Iteration rules:
  - After EVERY individual fix, re-run the FULL sequence from step 1 — never just the one
    step that previously failed.
  - Read ALL errors output by a command in one pass, then fix ALL of them before re-running.
    Do not fix one error, re-run, fix the next — batch the fixes per command.
  - A PR MUST NOT be opened until all four commands exit with code 0 in a single clean run.
  - If fixing one check introduces a regression in a previously passing check, resolve the
    regression before continuing.
  - Suppression shortcuts (`as any`, `@ts-ignore`, `// eslint-disable`) added purely to
    silence a failing check are FORBIDDEN — always fix the root cause.
## Docs review (end of every session)

Review each file below for accuracy; update stale sections:
  - AGENTS.md + docs/agent/*.md (living spec — update the relevant topic file)
  - README.md (quick start, scripts table, env-var table, project structure)
  - DEPLOYMENT.md (env-var names must match .env.example and scripts/vercel-install.sh exactly)
  - INTEGRATION-SUMMARY.md (reflect the current implemented vs. pending state)
  - ADMIN.md (admin panel features and setup steps)
  - SECURITY.md (security practices relevant to the actual code)
  - scripts/vercel-install.sh (env-var list must match .env.example)
  - .env.example (must list every variable the app actually reads)
This review is MANDATORY, not optional, even when no documentation changes were part of the original task.
Update Documentation: If new public APIs, components, or utilities were added, update the relevant docs in the docs/ directory or inline JSDoc comments.
Minimal Changes Principle: Make the smallest possible change that fully addresses the requirement. Do not refactor unrelated code in the same PR. Do not add new dependencies unless absolutely necessary — check npm audit for any new package.
Tested Modules (unit test files exist): `spotifyEmbedPath`, `utils/cn`, `syncLogs`, `youtubeApi`, `artistRowMapper`, `featureFlags`, `accreditations`, `labelMessages`, `artistReplies`, `journalistDownloads`, `r2Utils`, `platformUrlParser`, `slugify`, `ipRateLimit`.

## Task Decomposition & Multi-Agent Pattern — RECOMMENDED

### Large-Task Decomposition
Before starting any task with >3 distinct concerns, the agent MUST:
  1. Enumerate all sub-tasks as a numbered list in the PR description.
  2. Commit each sub-task as a SEPARATE atomic commit (one concern per commit).
  3. Run `npm run typecheck && npm test && npm run build` after EACH sub-task commit.
  This ensures partial work is always in a passing, mergeable state.

### Parallel Agent Sessions (Multi-Agent Pattern)
For large features spanning multiple independent modules, PREFER splitting the work into
separate GitHub Issues (one per module) rather than one monolithic PR.
Each issue/PR must be independently mergeable and must not block sibling branches.

Example split for a schema + DAL + UI task:
  - Issue A: supabase/reset.sql + src/types/database.ts  (schema layer)
  - Issue B: src/lib/api/*.ts DAL functions + unit tests  (data layer, depends on A)
  - Issue C: src/components/ + app/ UI changes            (presentation layer, depends on B)

Mark blocking relationships using GitHub's "blocking" issue feature.
A coding agent session should be started per issue for true parallel execution.

### Subtask Handoff
When an agent completes a subtask that another agent depends on, it MUST leave a summary
comment in the PR describing the exact exports / DB schema changes it introduced,
so the dependent agent can pick up accurately.

## Living spec maintenance

When new conventions or architectural decisions are introduced, update the relevant file in `docs/agent/` (and this index in `AGENTS.md` if a new topic file is added).

