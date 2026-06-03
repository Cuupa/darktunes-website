'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { sendArtistReply } from '@/lib/api/artistReplies'
import { REPLY_MAX_LENGTH, REPLY_MIN_LENGTH } from '../_constants'

export async function sendPortalReply(messageId: string, body: string, bodyHtml?: string) {
  const trimmedBody = body.trim()
  if (trimmedBody.length < REPLY_MIN_LENGTH || trimmedBody.length > REPLY_MAX_LENGTH) {
    throw new Error('Reply must be between 1 and 2000 characters')
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new Error('No artist linked')

  const { data: message } = await supabase
    .from('label_messages')
    .select('id, artist_id')
    .eq('id', messageId)
    .eq('artist_id', artist.id)
    .maybeSingle()

  if (!message) throw new Error('Unauthorized')

  return sendArtistReply(supabase, messageId, artist.id, trimmedBody, bodyHtml)
}
