/**
 * PATCH /api/admin/messages/[id]/ops
 * Shared-inbox operations on portal messages (to_label): claim, unclaim, priority, tags.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  claimPortalMessage,
  unclaimPortalMessage,
  updatePortalMessageOps,
} from '@/lib/api/messageOps'

const bodySchema = z.object({
  action: z.enum(['claim', 'unclaim', 'update']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
})

function extractId(req: NextRequest): string {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean)
  // .../messages/[id]/ops
  const idx = parts.indexOf('messages')
  return parts[idx + 1] ?? ''
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)
  const messageId = extractId(req)
  if (!messageId) throw new ApiError(400, 'Missing message id')

  const body = bodySchema.parse(await req.json())
  const supabase = await createServerSupabaseClient()

  if (body.action === 'claim') {
    const message = await claimPortalMessage(supabase, messageId, userId)
    return NextResponse.json({ message })
  }
  if (body.action === 'unclaim') {
    const message = await unclaimPortalMessage(supabase, messageId, userId)
    return NextResponse.json({ message })
  }

  if (!body.priority && !body.tags) {
    throw new ApiError(400, 'priority or tags required for update')
  }

  const message = await updatePortalMessageOps(supabase, messageId, userId, {
    priority: body.priority,
    tags: body.tags,
  })
  return NextResponse.json({ message })
})
