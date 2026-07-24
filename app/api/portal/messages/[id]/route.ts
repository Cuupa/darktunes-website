/**
 * app/api/portal/messages/[id]/route.ts
 *
 * PATCH — star, mark read, move folder, soft-delete, restore.
 * Auth: Bearer (preferred) or cookie (dual-auth).
 * Membership: message may belong to sender or recipient artist — resolve
 * membership against either, then pin via withPortalMembershipWrite.
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
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

const patchSchema = z.object({
  starred: z.boolean().optional(),
  markRead: z.boolean().optional(),
  folderId: z.string().uuid().nullable().optional(),
  deleted: z.boolean().optional(),
})

const ROUTE = 'PATCH /api/portal/messages/[id]'

function extractId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[segments.length - 1]
}

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  // Bootstrap auth to locate the message before artistId is known
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
  if (artistIds.length === 0) {
    throw new ApiError(403, 'Not authorized to update this message')
  }

  const { data: membership } = await serviceDb
    .from('artist_members')
    .select('artist_id')
    .in('artist_id', artistIds)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership?.artist_id) {
    throw new ApiError(403, 'Not authorized to update this message')
  }

  // Pin membership on the artist the user belongs to (sender or recipient)
  const ctx = await withPortalMembershipWrite(req, membership.artist_id)

  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { starred, markRead, folderId, deleted } = parsed.data

  if (starred !== undefined) {
    await portalMemberWrite(
      ctx,
      { route: ROUTE, table: 'portal_messages', operation: 'update' },
      (db) => togglePortalMessageStar(db, messageId, starred),
    )
  }
  if (markRead === true) {
    await portalMemberWrite(
      ctx,
      { route: ROUTE, table: 'portal_messages', operation: 'update' },
      (db) => markPortalMessageRead(db, messageId),
    )
  }
  if (folderId !== undefined) {
    await portalMemberWrite(
      ctx,
      { route: ROUTE, table: 'portal_messages', operation: 'update' },
      (db) => movePortalMessage(db, messageId, folderId),
    )
  }
  if (deleted === true) {
    await portalMemberWrite(
      ctx,
      { route: ROUTE, table: 'portal_messages', operation: 'update' },
      (db) => softDeletePortalMessage(db, messageId),
    )
  } else if (deleted === false) {
    await portalMemberWrite(
      ctx,
      { route: ROUTE, table: 'portal_messages', operation: 'update' },
      (db) => restorePortalMessage(db, messageId),
    )
  }

  return NextResponse.json({ success: true })
})
