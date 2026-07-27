/**
 * app/api/portal/messages/send/route.ts
 *
 * POST /api/portal/messages/send
 * Auth: Bearer (preferred) or cookie session (dual-auth window).
 * Membership: withPortalMembershipWrite on fromArtistId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { sendPortalMessage } from '@/lib/api/portalMessages'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { checkDistributedRateLimit } from '@/lib/rateLimitDistributed'
import { getClientIp } from '@/lib/ipRateLimit'
import { PORTAL_MESSAGE_SEND_RATE } from '@/lib/uploads/portalUploadLimits'

const sendSchema = z.object({
  fromArtistId: z.string().uuid(),
  toArtistId: z.string().uuid().nullable().optional(),
  toLabel: z.boolean().optional().default(false),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().max(50000),
  bodyHtml: z.string().max(200000).nullable().optional(),
})

const ROUTE = 'POST /api/portal/messages/send'

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const body: unknown = await req.json()
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { fromArtistId, toArtistId, toLabel, subject, body: msgBody, bodyHtml } = parsed.data
  if (!toLabel && !toArtistId) {
    throw new ApiError(400, 'Either toArtistId or toLabel must be provided')
  }

  const ctx = await withPortalMembershipWrite(req, fromArtistId)

  const ip = getClientIp(req)
  const rl = await checkDistributedRateLimit(
    `messages-send:${ctx.user.id}:${ip}`,
    PORTAL_MESSAGE_SEND_RATE.max,
    PORTAL_MESSAGE_SEND_RATE.windowMs,
  )
  if (rl.limited) {
    throw new ApiError(429, 'Too many messages. Please wait and try again.')
  }

  if (toArtistId) {
    const { value: targetArtist } = await portalMemberWrite(
      ctx,
      { route: ROUTE, table: 'artists', operation: 'select' },
      async (db) => {
        const { data } = await db.from('artists').select('id').eq('id', toArtistId).maybeSingle()
        return data
      },
    )
    if (!targetArtist) throw new ApiError(404, 'Recipient artist not found')
  }

  const { value: message } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'portal_messages', operation: 'insert' },
    (db) =>
      sendPortalMessage(db, {
        fromArtistId: ctx.artist.id,
        toArtistId: toArtistId ?? null,
        toLabel,
        subject,
        body: msgBody,
        bodyHtml: bodyHtml ?? null,
      }),
  )

  if (toLabel) {
    // Staff notifications — always service role
    const [{ data: artist }, { data: recipientProfiles }] = await Promise.all([
      ctx.serviceDb.from('artists').select('name').eq('id', fromArtistId).maybeSingle(),
      ctx.serviceDb.from('users').select('id').in('role', ['admin', 'editor']),
    ])

    const artistName = artist?.name ?? 'Artist'
    const recipients = (recipientProfiles ?? []).map((profile) => ({
      recipient_id: profile.id,
      type: 'artist_portal_message',
      entity_type: 'portal_message',
      entity_id: message.id,
      entity_name: `${artistName}: ${subject}`,
      sender_id: ctx.user.id,
      read: false,
    }))

    if (recipients.length > 0) {
      await ctx.serviceDb.from('editor_notifications').insert(recipients)
    }
  }

  return NextResponse.json({ message }, { status: 201 })
})
