/**
 * POST /api/admin/ai/connection-tests
 * Admin-only NVIDIA probe. Never retries on failure.
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildApiError, withErrorHandler } from '@/lib/errors'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { resolveNvidiaApiKey } from '@/lib/ai/provider/resolveKey'
import { runNvidiaConnectionTest } from '@/lib/ai/provider/connectionTest'

export const maxDuration = 60

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
