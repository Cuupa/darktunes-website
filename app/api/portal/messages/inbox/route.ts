/**
 * app/api/portal/messages/inbox/route.ts
 *
 * GET /api/portal/messages/inbox?artistId=<uuid>&folder=<id|system>
 * Returns messages received by the active artist.
 *
 * Security: caller must be a member of the requested artistId.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { getLabelMessages } from '@/lib/api/labelMessages'
import { getRepliesForMessage } from '@/lib/api/artistReplies'
import {
  getInboxMessages,
  getSentMessages,
  getStarredMessages,
  getTrashedMessages,
} from '@/lib/api/portalMessages'

export const GET = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const { searchParams } = new URL(req.url)
  const artistId = searchParams.get('artistId')
  const folder = searchParams.get('folder') ?? 'inbox'

  if (!artistId) throw new ApiError(400, 'artistId is required')

  // Verify membership
  const { data: membership } = await supabase
    .from('artist_members')
    .select('id')
    .eq('artist_id', artistId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) throw new ApiError(403, 'Not a member of this artist')

  let messages
  if (folder === 'sent') {
    messages = await getSentMessages(supabase, artistId)
  } else if (folder === 'starred') {
    messages = await getStarredMessages(supabase, artistId)
  } else if (folder === 'trash') {
    messages = await getTrashedMessages(supabase, artistId)
  } else if (folder === 'inbox') {
    messages = await getInboxMessages(supabase, artistId)
  } else {
    // Custom folder by ID
    messages = await getInboxMessages(supabase, artistId, folder)
  }

  if (folder === 'inbox') {
    const labelMessages = await getLabelMessages(supabase, artistId)
    const repliesEntries = await Promise.allSettled(
      labelMessages.map(async (message) => [message.id, await getRepliesForMessage(supabase, message.id)] as const),
    )
    const labelReplies = repliesEntries.reduce<Record<string, Awaited<ReturnType<typeof getRepliesForMessage>>>>(
      (acc, result) => {
        if (result.status === 'fulfilled') acc[result.value[0]] = result.value[1]
        return acc
      },
      {},
    )
    return NextResponse.json({ messages, labelMessages, labelReplies })
  }

  return NextResponse.json({ messages })
})
