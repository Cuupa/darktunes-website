import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Concert } from '@/types'

type DbClient = SupabaseClient<Database>
type ConcertRow = Database['public']['Tables']['concerts']['Row']

function rowToConcert(row: ConcertRow): Concert {
  return {
    id: row.id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    eventName: row.event_name,
    venueName: row.venue_name,
    venueCity: row.venue_city,
    venueCountry: row.venue_country,
    concertDate: row.concert_date,
    ticketUrl: row.ticket_url,
    songkickId: row.songkick_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getConcertsByArtistId(db: DbClient, artistId: string): Promise<Concert[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await db
    .from('concerts')
    .select('*')
    .eq('artist_id', artistId)
    .gte('concert_date', today)
    .order('concert_date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToConcert)
}

export async function getConcerts(db: DbClient): Promise<Concert[]> {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await db
    .from('concerts')
    .select('*')
    .gte('concert_date', today)
    .order('concert_date', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? [])
    .map(rowToConcert)
    .sort((a, b) => {
      const aPriority = a.status === 'ok' ? 0 : 1
      const bPriority = b.status === 'ok' ? 0 : 1
      if (aPriority !== bPriority) return aPriority - bPriority
      return new Date(a.concertDate).getTime() - new Date(b.concertDate).getTime()
    })
}
