/**
 * app/api/portal/messages/[id]/route.ts
 *
 * PATCH /api/portal/messages/:id
 * Update a portal message: star, mark read, move to folder, soft-delete, restore.
 *
 * Body: { starred?, readAt?, folderId?, deleted? }
 *
 * Security: caller must be a member of either the sender or recipient artist.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import {
  markPortalMessageRead,
  togglePortalMessageStar,
  movePortalMessage,
  softDeletePortalMessage,
  restorePortalMessage,
} from '@/lib/api/portalMessages'

const patchSchema = z.object({
  starred: z.boolean().optional(),
  markRead: z.boolean().optional(),
  folderId: z.string().uuid().nullable().optional(),
  deleted: z.boolean().optional(),
})

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const messageId = extractId(req)

  // Load message to check ownership
  const { data: msg } = await supabase
    .from('portal_messages')
    .select('id, from_artist_id, to_artist_id')
    .eq('id', messageId)
    .maybeSingle()

  if (!msg) throw new ApiError(404, 'Message not found')

  // Check user is member of sender or recipient artist
  const artistIds = [msg.from_artist_id, msg.to_artist_id].filter(Boolean) as string[]
  const { data: membership } = await supabase
    .from('artist_members')
    .select('id')
    .in('artist_id', artistIds)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) throw new ApiError(403, 'Not authorized to update this message')

  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { starred, markRead, folderId, deleted } = parsed.data

  if (starred !== undefined) {
    await togglePortalMessageStar(supabase, messageId, starred)
  }
  if (markRead === true) {
    await markPortalMessageRead(supabase, messageId)
  }
  if (folderId !== undefined) {
    await movePortalMessage(supabase, messageId, folderId)
  }
  if (deleted === true) {
    await softDeletePortalMessage(supabase, messageId)
  } else if (deleted === false) {
    await restorePortalMessage(supabase, messageId)
  }

  return NextResponse.json({ success: true })
})
