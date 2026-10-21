# AI Assistant

NVIDIA NIM-backed assistant for the artist portal and admin dashboard.

## Enablement

The assistant stays off until:

1. An NVIDIA API key exists (Admin → API Keys, group NVIDIA, or `NVIDIA_API_KEY`)
2. Admin → AI Assistant has **enabled** turned on (`ai_settings.enabled`)

`AI_ENABLED=true` only seeds/overrides enablement for local tests. `test_mode` allows the mock provider outside production.

## Models

Defaults (also `ai_settings` column defaults / `DEFAULT_AI_MODELS`):

| Role | ID |
|---|---|
| Fast | `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Reasoning | `nvidia/nemotron-3-super-120b-a12b` |

Admin → AI Assistant → Models lists live NVIDIA NIM ids (`GET /api/admin/ai/models` → `GET {NVIDIA_API_BASE_URL}/models`) and PATCHes `model_fast` / `model_reasoning`. Chat turns and connection tests use the saved rows.

The NVIDIA adapter serializes internal tool calls to the OpenAI-compatible `tool_calls: [{id,type:'function',function:{name,arguments}}]` wire format and pairs subsequent tool replies with `tool_call_id`. Abort and timeout signals remain active while the streaming response is read.

Hosted NVIDIA inference can return HTTP 503 `ResourceExhausted: Worker local total request limit reached (N/N)` during shared worker saturation. Chat completions retry retryable provider errors (429/502/503/504, timeout, network) up to 3 attempts with jittered exponential backoff, honouring `Retry-After` up to four seconds; a longer server delay fails promptly instead of holding the request open. Partially streamed outputs, auth failures, and unsupported requests are never retried. Explicit `abort(requestId)` never retries. Admin Health shows the saturation details after retries are exhausted. The initial `auth` health step confirms only that a key exists locally, not that NVIDIA authenticated it.

Provider adapter: `src/lib/ai/provider/`. Domain code never imports NVIDIA payload types. Connection tests record which extras (`enable_thinking`, `low_effort`, `reasoning_budget`, tools+stream) the live API accepted. Connection tests stay single-attempt. SSE parsers accept LF and CRLF frames.

`max_tokens` includes reasoning tokens when thinking is on.

## Token budgets

Atomic reservation: `reserve_ai_tokens` / `settle_ai_tokens` in `supabase/reset.sql`.

Each NVIDIA completion in a tool-calling turn gets a separate atomic reservation (`requestId:round`) and settlement. Provider usage is accumulated across all rounds before recording the conversation total. A failed in-flight round consumes its outstanding reservation; previous completed rounds are already settled.

Local estimates use `ceil(chars / 3.2) * 1.15`. Provider `usage` is authoritative after the call. Failed/unknown calls settle the reserved amount, never zero.

Per-user day/month caps come from the caller’s role numbers. Global day/month caps apply to everyone.

## API

REST resources under `/api/ai/*` and `/api/admin/ai/*`. Chat turns stream SSE events: `status`, `delta`, `tool_start`, `tool_result`, `confirmation_required`, `usage`, `error`, `done`.

## Tools

Server-side `ToolRegistry`. Artist tools are scoped to the membership-resolved `artistId`. Admin tools require `admin.panel.full` or `admin.panel.editor`. No arbitrary SQL.

Write tools only prepare a payload. `POST /api/ai/action-confirmations` re-checks authz, then runs existing DAL (EPK bio, press quote, release wizard draft, Zammad outbox, diagnostic report). Consuming a confirmation marks the row used with `UPDATE … WHERE used_at IS NULL` and rejects a zero-row update (concurrent confirm). Confirmation tokens are not stored in the model transcript.

`POST /api/ai/diagnostic-reports` looks up a log row by fingerprint or a literal `error_id` substring (`%` / `_` rejected). Zammad sends claim `integration_outbox` rows as `sending` (with a 60s retry) before `createZammadTicket`; a crash leaves the row reclaimable.

## Diagnostics

Rule-based watch alerts run inside the health snapshot (no LLM). `POST /api/ai/diagnostics` classifies a log row. Diagnostic reports state that source maps were not read. Zammad sends go through `integration_outbox` with fingerprint dedup after the `sending` claim.

## Schema

Apply `supabase/reset.sql` (`npm run db:apply`). No `supabase/migrations/`.

## Tests

- Mock unit/route tests run in `npm test` / `npm run ci`
- Live NVIDIA: `NVIDIA_API_KEY=… AI_LIVE_TESTS=1 npm run test:ai:live`

Playwright E2E is forbidden in this repo. Manual UI coverage lives in `QA_CHECKLIST.md`.
