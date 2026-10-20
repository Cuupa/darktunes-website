/**
 * POST /api/ai/conversations/{id}/cancellations
 */

import { NextRequest, NextResponse } from 'next/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { requireAiActor } from '@/lib/ai/auth/requireAiActor'
import { getAiConversationForUser } from '@/lib/api/aiConversations'
import { abortAiTurn, conversationTurnKey } from '@/lib/ai/orchestrator/abortRegistry'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean)
  const id = parts[parts.length - 2] ?? ''
  if (!id) throw new ApiError(400, 'Missing conversation id')
  const actor = await requireAiActor(req)
  await getAiConversationForUser(actor.serviceDb, id, actor.userId)
  abortAiTurn(conversationTurnKey(id))
  return NextResponse.json({ cancelled: true })
})
