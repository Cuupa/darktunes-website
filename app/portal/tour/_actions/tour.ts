'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'

interface CreateTourInput {
  eventName: string
  concertDate: string
  venueName?: string
  venueCity?: string
  venueCountry?: string
  ticketUrl?: string
  status: 'announced' | 'confirmed' | 'cancelled'
}

export async function createTourDate(input: CreateTourInput) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new Error('No artist linked')

  const { data, error } = await supabase
    .from('concerts')
    .insert({
      artist_id: artist.id,
      event_name: input.eventName,
      concert_date: input.concertDate,
      venue_name: input.venueName || null,
      venue_city: input.venueCity || null,
      venue_country: input.venueCountry || null,
      ticket_url: input.ticketUrl || null,
      status: input.status,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Create failed')
  return data
}

export async function deleteTourDate(id: string) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new Error('No artist linked')

  const { error } = await supabase
    .from('concerts')
    .delete()
    .eq('id', id)
    .eq('artist_id', artist.id)
  if (error) throw new Error(error.message)
}
