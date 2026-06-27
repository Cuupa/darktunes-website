import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { ApiError } from '@/lib/errors'
import { getTourById } from '@/lib/api/tours'
import { getTourCollaborators } from '@/lib/api/tourCollaborators'

type DbClient = SupabaseClient<Database>

export type TourAccessRole = 'owner' | 'collaborator'

export interface TourAccess {
  tourId: string
  artistId: string
  ownerArtistId: string
  role: TourAccessRole
  canManageCollaborators: boolean
}

export async function getTourCollaboratorRole(
  db: DbClient,
  tourId: string,
  artistId: string,
): Promise<TourAccessRole | null> {
  const { data, error } = await db
    .from('tour_collaborators')
    .select('artist_id')
    .eq('tour_id', tourId)
    .eq('artist_id', artistId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? 'collaborator' : null
}

export async function getTourAccess(
  db: DbClient,
  tourId: string,
  artistId: string,
): Promise<TourAccess | null> {
  const tour = await getTourById(db, tourId)
  if (!tour) return null

  if (tour.artistId === artistId) {
    return {
      tourId,
      artistId,
      ownerArtistId: tour.artistId,
      role: 'owner',
      canManageCollaborators: true,
    }
  }

  const collaboratorRole = await getTourCollaboratorRole(db, tourId, artistId)
  if (!collaboratorRole) return null

  return {
    tourId,
    artistId,
    ownerArtistId: tour.artistId,
    role: collaboratorRole,
    canManageCollaborators: false,
  }
}

export async function assertTourAccess(
  db: DbClient,
  tourId: string,
  artistId: string,
): Promise<TourAccess> {
  const access = await getTourAccess(db, tourId, artistId)
  if (!access) throw new ApiError(404, 'Tour not found')
  return access
}

export async function assertTourOwner(
  db: DbClient,
  tourId: string,
  artistId: string,
): Promise<TourAccess> {
  const access = await assertTourAccess(db, tourId, artistId)
  if (access.role !== 'owner') throw new ApiError(403, 'Only the tour owner can perform this action')
  return access
}

/** Tour owner plus invited collaborators — valid co-headline roster picks. */
export async function getTourRosterArtistIds(db: DbClient, tourId: string): Promise<Set<string>> {
  const tour = await getTourById(db, tourId)
  if (!tour) return new Set()

  const collaborators = await getTourCollaborators(db, tourId)
  return new Set([tour.artistId, ...collaborators.map((c) => c.artistId)])
}

export async function assertValidPerformingArtists(
  db: DbClient,
  tourId: string,
  artistIds: string[],
): Promise<void> {
  if (artistIds.length === 0) return
  const allowed = await getTourRosterArtistIds(db, tourId)
  for (const id of artistIds) {
    if (!allowed.has(id)) throw new ApiError(400, 'Invalid performing artist for this tour')
  }
}