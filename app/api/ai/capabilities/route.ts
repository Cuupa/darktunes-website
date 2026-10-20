/**
 * GET /api/ai/capabilities
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/errors'
import { requireAiActor } from '@/lib/ai/auth/requireAiActor'
import { getAiSettings } from '@/lib/api/aiSettings'
import { resolveNvidiaApiKey } from '@/lib/ai/provider/resolveKey'
import { listToolDefinitionsForActor } from '@/lib/ai/tools/registry'
import { FAST_MODEL_ID, REASONING_MODEL_ID } from '@/lib/ai/models/profiles'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const artistId = req.nextUrl.searchParams.get('artist_id')
  const actor = await requireAiActor(req, {
    artistId,
    requireArtist: Boolean(artistId),
  })
  const settings = await getAiSettings(actor.serviceDb)
  const key = await resolveNvidiaApiKey(actor.serviceDb)
  return NextResponse.json({
    enabled: settings.enabled && Boolean(key),
    provider: settings.provider,
    models: {
      fast: settings.modelFast || FAST_MODEL_ID,
      reasoning: settings.modelReasoning || REASONING_MODEL_ID,
    },
    streaming: settings.defaultStreaming,
    tools: listToolDefinitionsForActor(actor).map((tool) => tool.name),
  })
})
