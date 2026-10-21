/**
 * POST /api/admin/ai/connection-tests
 * Admin-only NVIDIA probe. Never retries on failure.
 */

import type { ErrorCode } from '@/lib/errorCodes'
import { NextRequest, NextResponse } from 'next/server'
import { buildApiError, withErrorHandler } from '@/lib/errors'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { resolveNvidiaApiKey } from '@/lib/ai/provider/resolveKey'
import { runNvidiaConnectionTest } from '@/lib/ai/provider/connectionTest'
import type { ConnectionTestStepId } from '@/lib/ai/provider/connectionTest'
import { updateAiSettings } from '@/lib/api/aiSettings'

export const maxDuration = 60

function stepErrorToApi(
  code: string | null,
): { apiCode: ErrorCode; status: number } {
  switch (code) {
    case 'INVALID_KEY':
      return { apiCode: 'AI_PROVIDER_INVALID_KEY', status: 401 }
    case 'MODEL_UNAVAILABLE':
      return { apiCode: 'AI_PROVIDER_MODEL_UNAVAILABLE', status: 502 }
    case 'RATE_LIMITED':
      return { apiCode: 'AI_PROVIDER_RATE_LIMITED', status: 429 }
    case 'TIMEOUT':
      return { apiCode: 'AI_PROVIDER_TIMEOUT', status: 504 }
    case 'NETWORK_ERROR':
      return { apiCode: 'AI_PROVIDER_NETWORK_ERROR', status: 503 }
    case 'TLS_ERROR':
      return { apiCode: 'AI_PROVIDER_TLS_ERROR', status: 503 }
    case 'INVALID_RESPONSE':
      return { apiCode: 'AI_PROVIDER_INVALID_RESPONSE', status: 502 }
    case 'TOOL_CALL_UNSUPPORTED':
      return { apiCode: 'AI_PROVIDER_TOOL_CALL_UNSUPPORTED', status: 400 }
    case 'PROVIDER_UNAVAILABLE':
    default:
      return { apiCode: 'AI_PROVIDER_UNAVAILABLE', status: 503 }
  }
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { userId, serviceClient } = await requireAdminWithServiceClient(req)

  const limited = await checkDistributedRateLimit(`ai-connection-test:${userId}`, 4, 10 * 60 * 1000)
  if (limited.limited) {
    throw buildApiError('RATE_LIMITED', 429)
  }

  const apiKey = await resolveNvidiaApiKey(serviceClient)
  if (!apiKey) {
    throw buildApiError('AI_NOT_CONFIGURED', 503)
  }

  const result = await runNvidiaConnectionTest({ apiKey })
  await updateAiSettings(serviceClient, {
    last_connection_test: {
      ok: result.ok,
      started_at: result.started_at,
      finished_at: result.finished_at,
      total_latency_ms: result.total_latency_ms,
      steps: result.steps,
      discovered_capabilities: result.discovered_capabilities,
    },
    provider_capabilities: result.discovered_capabilities,
  }).catch(() => undefined)

  if (!result.ok) {
    const failedStep = result.steps.find((s) => !s.ok)
    const { apiCode, status } = stepErrorToApi(failedStep?.error_code ?? null)
    throw buildApiError(apiCode, status)
  }

  return NextResponse.json({
    ok: result.ok,
    started_at: result.started_at,
    finished_at: result.finished_at,
    total_latency_ms: result.total_latency_ms,
    steps: result.steps,
    discovered_capabilities: result.discovered_capabilities,
    usage: result.usage,
  })
})
