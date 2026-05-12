'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { markMessageRead } from '@/lib/api/labelMessages'

export async function markPortalMessageRead(messageId: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new Error('No artist linked')

  const { data: message } = await supabase
    .from('label_messages')
    .select('id')
    .eq('id', messageId)
    .eq('artist_id', artist.id)
    .maybeSingle()
  if (!message) throw new Error('Message not found')

  return markMessageRead(supabase, messageId)
}
