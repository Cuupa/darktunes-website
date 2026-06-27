import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/types/database'
import type { Database } from '@/types/database'
import type {
  DealStructure,
  Settlement,
} from '@/lib/tour-planner/types'
import { ApiError } from '@/lib/errors'

type DbClient = SupabaseClient<Database>
type PrivateRow = Database['public']['Tables']['tour_stop_artist_private']['Row']

export interface TourStopPrivateData {
  stopId: string
  artistId: string
  deal: DealStructure | null
  settlement: Settlement | null
  privateNotes: string | null
  version: number
  updatedAt: string
}

function rowToPrivate(row: PrivateRow): TourStopPrivateData {
  return {
    stopId: row.stop_id,
    artistId: row.artist_id,
    deal: row.deal as DealStructure | null,
    settlement: row.settlement as Settlement | null,
    privateNotes: row.private_notes,
    version: row.version,
    updatedAt: row.updated_at,
  }
}

export async function getStopPrivateData(
  db: DbClient,
  stopId: string,
  artistId: string,
): Promise<TourStopPrivateData | null> {
  const { data, error } = await db
    .from('tour_stop_artist_private')
    .select('*')
    .eq('stop_id', stopId)
    .eq('artist_id', artistId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? rowToPrivate(data) : null
}

export async function upsertStopPrivateData(
  db: DbClient,
  stopId: string,
  artistId: string,
  patch: {
    deal?: DealStructure | null
    settlement?: Settlement | null
    privateNotes?: string | null
  },
  expectedUpdatedAt?: string,
): Promise<TourStopPrivateData> {
  const existing = await getStopPrivateData(db, stopId, artistId)

  if (existing && expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
    throw new ApiError(409, 'Stop private data was modified by another user')
  }

  const payload = {
    stop_id: stopId,
    artist_id: artistId,
    deal: (patch.deal !== undefined ? patch.deal : existing?.deal ?? null) as Json | null,
    settlement: (patch.settlement !== undefined ? patch.settlement : existing?.settlement ?? null) as Json | null,
    private_notes: patch.privateNotes !== undefined ? patch.privateNotes : existing?.privateNotes ?? null,
    version: (existing?.version ?? 0) + 1,
  }

  const { data, error } = await db
    .from('tour_stop_artist_private')
    .upsert(payload, { onConflict: 'stop_id,artist_id' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertStopPrivateData')
  return rowToPrivate(data)
}