import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

export interface TourCollaborator {
  artistId: string
  artistName: string
  artistSlug: string | null
  invitedBy: string | null
  createdAt: string
}

export async function getTourCollaborators(db: DbClient, tourId: string): Promise<TourCollaborator[]> {
  const { data, error } = await db
    .from('tour_collaborators')
    .select('artist_id, invited_by, created_at')
    .eq('tour_id', tourId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data?.length) return []

  const artistIds = data.map((row) => row.artist_id)
  const { data: artists, error: artistsError } = await db
    .from('artists')
    .select('id, name, slug')
    .in('id', artistIds)

  if (artistsError) throw new Error(artistsError.message)
  const artistMap = new Map((artists ?? []).map((a) => [a.id, a]))

  return data.map((row) => {
    const artist = artistMap.get(row.artist_id)
    return {
      artistId: row.artist_id,
      artistName: artist?.name ?? 'Unknown',
      artistSlug: artist?.slug ?? null,
      invitedBy: row.invited_by,
      createdAt: row.created_at,
    }
  })
}

export async function addTourCollaborator(
  db: DbClient,
  tourId: string,
  artistId: string,
  invitedBy: string,
): Promise<void> {
  const { error } = await db.from('tour_collaborators').insert({
    tour_id: tourId,
    artist_id: artistId,
    invited_by: invitedBy,
  })
  if (error) throw new Error(error.message)
}

export async function removeTourCollaborator(
  db: DbClient,
  tourId: string,
  artistId: string,
): Promise<void> {
  const { error } = await db
    .from('tour_collaborators')
    .delete()
    .eq('tour_id', tourId)
    .eq('artist_id', artistId)
  if (error) throw new Error(error.message)
}

export async function getCollaboratorTourIds(db: DbClient, artistId: string): Promise<string[]> {
  const { data, error } = await db
    .from('tour_collaborators')
    .select('tour_id')
    .eq('artist_id', artistId)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.tour_id)
}