/**
 * POST /api/ai/conversations/{id}/messages
 * Streams assistant events as SSE.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, buildApiError, handleRouteError, withErrorHandler } from '@/lib/errors'
import { requireAiActor } from '@/lib/ai/auth/requireAiActor'
import { runAiTurn } from '@/lib/ai/orchestrator/runTurn'
import { encodeSse, sseHeaders } from '@/lib/ai/orchestrator/sse'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'

export const maxDuration = 120

const bodySchema = z.object({
  content: z.string().min(1).max(8000),
  artist_id: z.string().uuid().nullable().optional(),
  locale: z.enum(['en', 'de', 'fr']).optional(),
  page: z
    .object({
      dashboard: z.enum(['portal', 'admin', 'editor']),
      path: z.string().max(200),
      locale: z.enum(['en', 'de', 'fr']),
    })
    .optional(),
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
    const parts = req.nextUrl.pathname.split('/').filter(Boolean)
    const conversationId = parts[parts.length - 2] ?? ''
    if (!conversationId) throw new ApiError(400, 'Missing conversation id')

    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      throw new ApiError(400, 'Invalid JSON body')
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) throw new ApiError(400, 'Invalid message payload', 'VALIDATION_ERROR')

    const actor = await requireAiActor(req, {
      artistId: parsed.data.artist_id,
      requireArtist: Boolean(parsed.data.artist_id),
    })
    const limited = await checkDistributedRateLimit(`ai-turn:${actor.userId}`, 20, 10 * 60 * 1000)
    if (limited.limited) throw buildApiError('RATE_LIMITED', 429)

    const requestId = crypto.randomUUID()
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const event of runAiTurn({
            actor,
            conversationId,
            userText: parsed.data.content,
            page: parsed.data.page,
            locale: parsed.data.locale ?? parsed.data.page?.locale ?? 'en',
            requestId,
          })) {
            controller.enqueue(encoder.encode(encodeSse(event)))
          }
        } catch (error) {
          const mapped = handleRouteError(req, error)
          const body = (await mapped.json()) as { code?: string; detail?: string; error?: string }
          controller.enqueue(
            encoder.encode(
              encodeSse({
                type: 'error',
                code: body.code ?? 'SERVER_ERROR',
                detail: body.detail ?? body.error ?? 'The assistant could not complete this turn.',
              }),
            ),
          )
        } finally {
          controller.close()
        }
      },
    })
    return new NextResponse(stream, { headers: sseHeaders() })
})
