import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { TourStop } from '@/types'
import { getStopPrivateData } from '@/lib/api/tourStopPrivate'
import { getPerformingArtistIdsByStopIds } from '@/lib/api/tourStopPerformingArtists'

type DbClient = SupabaseClient<Database>

/** Merge shared stop row with viewer-private financial fields and performing artists. */
export async function enrichTourStopsForViewer(
  db: DbClient,
  stops: TourStop[],
  viewingArtistId: string,
): Promise<TourStop[]> {
  if (stops.length === 0) return stops

  const stopIds = stops.map((s) => s.id)
  const performingMap = await getPerformingArtistIdsByStopIds(db, stopIds)

  return Promise.all(
    stops.map(async (stop) => {
      const privateData = await getStopPrivateData(db, stop.id, viewingArtistId)
      return {
        ...stop,
        deal: privateData?.deal ?? null,
        settlement: privateData?.settlement ?? null,
        notes: privateData?.privateNotes ?? null,
        privateDataVersion: privateData?.version ?? null,
        privateDataUpdatedAt: privateData?.updatedAt ?? null,
        performingArtistIds: performingMap.get(stop.id) ?? [],
      }
    }),
  )
}

export async function enrichTourStopForViewer(
  db: DbClient,
  stop: TourStop,
  viewingArtistId: string,
): Promise<TourStop> {
  const [enriched] = await enrichTourStopsForViewer(db, [stop], viewingArtistId)
  return enriched
}