/**
 * app/api/portal/messages/send/route.ts
 *
 * POST /api/portal/messages/send
 * Sends a portal message from the active artist to another artist or to the label.
 *
 * Body: { fromArtistId, toArtistId?, toLabel?, subject, body, bodyHtml? }
 *
 * Security: caller must be a member of fromArtistId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { sendPortalMessage } from '@/lib/api/portalMessages'

const sendSchema = z.object({
  fromArtistId: z.string().uuid(),
  toArtistId: z.string().uuid().nullable().optional(),
  toLabel: z.boolean().optional().default(false),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().max(50000),
  bodyHtml: z.string().max(200000).nullable().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const body: unknown = await req.json()
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const { fromArtistId, toArtistId, toLabel, subject, body: msgBody, bodyHtml } = parsed.data

  // Verify sender membership
  const { data: membership } = await supabase
    .from('artist_members')
    .select('id')
    .eq('artist_id', fromArtistId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) throw new ApiError(403, 'Not a member of the sender artist')

  if (!toLabel && !toArtistId) {
    throw new ApiError(400, 'Either toArtistId or toLabel must be provided')
  }

  // If sending to another artist, verify that artist exists
  if (toArtistId) {
    const { data: targetArtist } = await supabase
      .from('artists')
      .select('id')
      .eq('id', toArtistId)
      .maybeSingle()

    if (!targetArtist) throw new ApiError(404, 'Recipient artist not found')
  }

  const message = await sendPortalMessage(supabase, {
    fromArtistId,
    toArtistId: toArtistId ?? null,
    toLabel,
    subject,
    body: msgBody,
    bodyHtml: bodyHtml ?? null,
  })

  return NextResponse.json({ message }, { status: 201 })
})
