import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Concert } from '@/types'

type DbClient = SupabaseClient<Database>
type ConcertRow = Database['public']['Tables']['concerts']['Row']
export type ConcertInsert = Database['public']['Tables']['concerts']['Insert']
export type ConcertUpdate = Database['public']['Tables']['concerts']['Update']

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
    bandsintownId: row.bandsintown_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventTime: row.event_time ?? null,
    eventType: row.event_type ?? 'gig',
    trailerUrl: row.trailer_url ?? null,
    venueLat: row.venue_lat ?? null,
    venueLng: row.venue_lng ?? null,
    venueOsmId: row.venue_osm_id ?? null,
    newsPostId: row.news_post_id ?? null,
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
  const concerts = (data ?? []).map(rowToConcert)
  return attachConcertArtists(db, concerts)
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

export async function createConcert(db: DbClient, concertData: ConcertInsert): Promise<Concert> {
  const { data, error } = await db.from('concerts').insert(concertData).select('*').single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createConcert')
  return rowToConcert(data)
}

export async function updateConcert(
  db: DbClient,
  id: string,
  concertData: ConcertUpdate,
): Promise<Concert> {
  const { data, error } = await db
    .from('concerts')
    .update(concertData)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateConcert')
  return rowToConcert(data)
}

export async function deleteConcert(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('concerts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Public-facing query: returns only concerts for visible artists.
 * Used by the public homepage (Server Component). The admin uses getConcerts instead.
 */
export async function getPublicConcerts(db: DbClient): Promise<Concert[]> {
  const today = new Date().toISOString().split('T')[0]

  // Fetch IDs of hidden artists to exclude their concerts
  const { data: hiddenArtistRows, error: hiddenErr } = await db
    .from('artists')
    .select('id')
    .eq('is_visible', false)
  if (hiddenErr) throw new Error(hiddenErr.message)

  const hiddenIds = (hiddenArtistRows ?? []).map((a) => a.id)

  let builder = db
    .from('concerts')
    .select('*')
    .gte('concert_date', today)
    .order('concert_date', { ascending: true })

  if (hiddenIds.length > 0) {
    builder = builder.or(`artist_id.is.null,artist_id.not.in.(${hiddenIds.join(',')})`)
  }

  const { data, error } = await builder
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

/**
 * Attach featured/supporting artists to concerts from the concert_artists junction table.
 */
export async function attachConcertArtists(db: DbClient, concerts: Concert[]): Promise<Concert[]> {
  if (concerts.length === 0) return concerts

  try {
    const ids = concerts.map((c) => c.id)
    const { data, error } = await db
      .from('concert_artists')
      .select('concert_id, artist_id, sort_order, artists(id, name, slug)')
      .in('concert_id', ids)
      .order('sort_order', { ascending: true })
    if (error) return concerts // graceful fallback

    type JoinRow = { concert_id: string; artist_id: string; sort_order: number; artists: { id: string; name: string; slug: string } | null }

    const byId: Record<string, { id: string; name: string; slug: string }[]> = {}
    for (const row of (data ?? []) as JoinRow[]) {
      if (!row.artists) continue
      if (!byId[row.concert_id]) byId[row.concert_id] = []
      byId[row.concert_id].push(row.artists)
    }

    return concerts.map((c) => ({ ...c, featuredArtists: byId[c.id] ?? [] }))
  } catch {
    return concerts // graceful fallback when mock/DB doesn't support .in()
  }
}

/**
 * Replace the concert_artists rows for a concert.
 */
export async function setConcertArtists(
  db: DbClient,
  concertId: string,
  artistIds: string[],
): Promise<void> {
  await db.from('concert_artists').delete().eq('concert_id', concertId)
  if (artistIds.length === 0) return
  const rows = artistIds.map((artist_id, i) => ({ concert_id: concertId, artist_id, sort_order: i }))
  const { error } = await db.from('concert_artists').insert(rows)
  if (error) throw new Error(error.message)
}


