/**
 * GET  /api/ai/conversations — list the caller's conversations
 * POST /api/ai/conversations — create a conversation
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'
import { requireAiActor } from '@/lib/ai/auth/requireAiActor'
import { createAiConversation, listAiConversations } from '@/lib/api/aiConversations'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'

const createSchema = z.object({
  artist_id: z.string().uuid().nullable().optional(),
  title: z.string().max(120).optional(),
})

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const artistId = req.nextUrl.searchParams.get('artist_id')
  const actor = await requireAiActor(req, {
    artistId,
    requireArtist: Boolean(artistId),
  })
  const listed = await listAiConversations(actor.serviceDb, {
    userId: actor.userId,
    artistId: actor.artistId,
    cursor: req.nextUrl.searchParams.get('cursor'),
    limit: Number(req.nextUrl.searchParams.get('page_size') ?? 50) || 50,
  })
  return NextResponse.json(listed)
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) throw new ApiError(400, 'Invalid conversation payload', 'VALIDATION_ERROR')

  const actor = await requireAiActor(req, {
    artistId: parsed.data.artist_id,
    requireArtist: Boolean(parsed.data.artist_id),
  })
  const limited = await checkDistributedRateLimit(`ai-conversations:${actor.userId}`, 30, 10 * 60 * 1000)
  if (limited.limited) throw buildApiError('RATE_LIMITED', 429)

  const conversation = await createAiConversation(actor.serviceDb, {
    userId: actor.userId,
    artistId: actor.artistId,
    accessContext: actor.accessContext,
    title: parsed.data.title,
  })
  return NextResponse.json(
    {
      id: conversation.id,
      user_id: conversation.userId,
      artist_id: conversation.artistId,
      access_context: conversation.accessContext,
      title: conversation.title,
      status: conversation.status,
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    },
    { status: 201, headers: { Location: `/api/ai/conversations/${conversation.id}` } },
  )
})
