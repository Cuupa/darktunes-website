/**
 * app/api/portal/messages/[id]/route.ts
 *
 * PATCH — star, mark read, move folder, soft-delete, restore.
 * Auth: Bearer (preferred) or cookie (dual-auth).
 * Membership: user must belong to sender or recipient artist.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, withErrorHandler } from '@/lib/errors'
import {
  markPortalMessageRead,
  togglePortalMessageStar,
  movePortalMessage,
  softDeletePortalMessage,
  restorePortalMessage,
} from '@/lib/api/portalMessages'
import { authenticatePortalBearer } from '@/lib/portal/bearerAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

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
  // Dual auth (Bearer or cookie)
  const { user } = await authenticatePortalBearer(req)
  const serviceDb = await createServiceRoleSupabaseClient()

  const messageId = extractId(req)

  const { data: msg } = await serviceDb
    .from('portal_messages')
    .select('id, from_artist_id, to_artist_id')
    .eq('id', messageId)
    .maybeSingle()

  if (!msg) throw new ApiError(404, 'Message not found')

  const artistIds = [msg.from_artist_id, msg.to_artist_id].filter(Boolean) as string[]
  const { data: membership } = await serviceDb
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

  // Membership verified — mutate via service role (band-member safe)
  if (starred !== undefined) {
    await togglePortalMessageStar(serviceDb, messageId, starred)
  }
  if (markRead === true) {
    await markPortalMessageRead(serviceDb, messageId)
  }
  if (folderId !== undefined) {
    await movePortalMessage(serviceDb, messageId, folderId)
  }
  if (deleted === true) {
    await softDeletePortalMessage(serviceDb, messageId)
  } else if (deleted === false) {
    await restorePortalMessage(serviceDb, messageId)
  }

  return NextResponse.json({ success: true })
})
