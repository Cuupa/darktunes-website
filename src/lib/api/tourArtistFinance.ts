import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/types/database'
import type { Database } from '@/types/database'
import type { TourBudget } from '@/lib/tour-planner/types'
import { EMPTY_TOUR_BUDGET } from '@/lib/tour-planner/types'
import { ApiError } from '@/lib/errors'

type DbClient = SupabaseClient<Database>
type FinanceRow = Database['public']['Tables']['tour_artist_finance']['Row']

export interface TourArtistFinance {
  tourId: string
  artistId: string
  budget: TourBudget | null
  totalBudget: number | null
  currency: string
  version: number
  updatedAt: string
}

function parseBudget(raw: Json | null): TourBudget | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const candidate = raw as unknown as TourBudget
  if (!Array.isArray(candidate.lines)) return EMPTY_TOUR_BUDGET
  return candidate
}

function rowToFinance(row: FinanceRow): TourArtistFinance {
  return {
    tourId: row.tour_id,
    artistId: row.artist_id,
    budget: parseBudget(row.budget),
    totalBudget: row.total_budget !== null ? Number(row.total_budget) : null,
    currency: row.currency,
    version: row.version,
    updatedAt: row.updated_at,
  }
}

export async function getTourArtistFinance(
  db: DbClient,
  tourId: string,
  artistId: string,
): Promise<TourArtistFinance | null> {
  const { data, error } = await db
    .from('tour_artist_finance')
    .select('*')
    .eq('tour_id', tourId)
    .eq('artist_id', artistId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? rowToFinance(data) : null
}

export async function upsertTourArtistFinance(
  db: DbClient,
  tourId: string,
  artistId: string,
  patch: {
    budget?: TourBudget | null
    totalBudget?: number | null
    currency?: string
  },
  expectedUpdatedAt?: string,
): Promise<TourArtistFinance> {
  const existing = await getTourArtistFinance(db, tourId, artistId)

  if (existing && expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
    throw new ApiError(409, 'Tour budget was modified by another user')
  }

  const payload = {
    tour_id: tourId,
    artist_id: artistId,
    budget: (patch.budget !== undefined ? patch.budget : existing?.budget ?? null) as Json | null,
    total_budget: patch.totalBudget !== undefined ? patch.totalBudget : existing?.totalBudget ?? null,
    currency: patch.currency ?? existing?.currency ?? 'EUR',
    version: (existing?.version ?? 0) + 1,
  }

  const { data, error } = await db
    .from('tour_artist_finance')
    .upsert(payload, { onConflict: 'tour_id,artist_id' })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertTourArtistFinance')
  return rowToFinance(data)
}