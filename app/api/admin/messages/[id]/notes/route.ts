/**
 * GET/POST /api/admin/messages/[id]/notes?source=portal|label
 * Staff-only internal notes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { addInternalNote, listInternalNotes, type MessageSource } from '@/lib/api/messageOps'

const postSchema = z.object({
  body: z.string().min(1).max(10000),
  source: z.enum(['label', 'portal']).default('portal'),
})

function extractId(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean)
  const idx = parts.indexOf('messages')
  return parts[idx + 1] ?? ''
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdminOrEditor(token)
  const messageId = extractId(req)
  if (!messageId) throw new ApiError(400, 'Missing message id')

  const source = (req.nextUrl.searchParams.get('source') ?? 'portal') as MessageSource
  if (source !== 'label' && source !== 'portal') {
    throw new ApiError(400, 'Invalid source')
  }

  const supabase = await createServerSupabaseClient()
  const notes = await listInternalNotes(supabase, source, messageId)
  return NextResponse.json({ notes })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)
  const messageId = extractId(req)
  if (!messageId) throw new ApiError(400, 'Missing message id')

  const parsed = postSchema.parse(await req.json())
  const supabase = await createServerSupabaseClient()
  const note = await addInternalNote(supabase, {
    source: parsed.source,
    messageId,
    authorUserId: userId,
    body: parsed.body,
  })
  return NextResponse.json({ note }, { status: 201 })
})
