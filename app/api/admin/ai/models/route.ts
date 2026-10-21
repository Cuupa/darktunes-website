/**
 * GET /api/admin/ai/models
 * Returns the models advertised by NVIDIA NIM (server-side proxy to /v1/models).
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildApiError, withErrorHandler } from '@/lib/errors'
import { requireAdminWithServiceClient } from '@/lib/adminAuth'
import { resolveNvidiaApiKey } from '@/lib/ai/provider/resolveKey'
import { NVIDIA_MODELS_URL, parseNvidiaModelsList } from '@/lib/ai/provider/nvidiaModels'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { serviceClient } = await requireAdminWithServiceClient(req)

  const apiKey = await resolveNvidiaApiKey(serviceClient)
  if (!apiKey) {
    throw buildApiError('AI_NOT_CONFIGURED', 503)
  }

  const response = await fetch(NVIDIA_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    next: { revalidate: 3600 },
  })
  if (!response.ok) {
    throw buildApiError('AI_PROVIDER_UNAVAILABLE', 503)
  }

  const models = parseNvidiaModelsList(await response.json())
  return NextResponse.json({ models })
})
