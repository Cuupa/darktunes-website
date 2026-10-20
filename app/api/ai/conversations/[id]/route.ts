/**
 * GET    /api/ai/conversations/{id}
 * DELETE /api/ai/conversations/{id}
 */

import { NextRequest, NextResponse } from 'next/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { requireAiActor } from '@/lib/ai/auth/requireAiActor'
import {
  deleteAiConversation,
  getAiConversationForUser,
  listAiMessages,
} from '@/lib/api/aiConversations'

function conversationIdFrom(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const id = conversationIdFrom(req)
  if (!id) throw new ApiError(400, 'Missing conversation id')
  const actor = await requireAiActor(req)
  const conversation = await getAiConversationForUser(actor.serviceDb, id, actor.userId)
  const messages = await listAiMessages(actor.serviceDb, conversation.id)
  return NextResponse.json({
    id: conversation.id,
    user_id: conversation.userId,
    artist_id: conversation.artistId,
    access_context: conversation.accessContext,
    title: conversation.title,
    status: conversation.status,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
    messages: messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      model: message.model,
      token_usage: message.tokenUsage,
      status: message.status,
      created_at: message.createdAt,
    })),
  })
})

export const DELETE = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const id = conversationIdFrom(req)
  if (!id) throw new ApiError(400, 'Missing conversation id')
  const actor = await requireAiActor(req)
  await deleteAiConversation(actor.serviceDb, id, actor.userId)
  return new NextResponse(null, { status: 204 })
})
