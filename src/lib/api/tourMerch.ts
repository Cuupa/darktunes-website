import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { TourMerchItem, TourMerchSettlementRecord } from '@/types'
import type { MerchSettlement, MerchVariant } from '@/lib/tour-planner/types'

type DbClient = SupabaseClient<Database>

function rowToMerchItem(row: Database['public']['Tables']['tour_merch_items']['Row']): TourMerchItem {
  return {
    id: row.id,
    artistId: row.artist_id,
    sku: row.sku,
    name: row.name,
    category: row.category as TourMerchItem['category'],
    variants: (row.variants as unknown as MerchVariant[]) ?? [],
    basePrice: Number(row.base_price),
    currency: row.currency,
    box: row.box,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToMerchSettlement(
  row: Database['public']['Tables']['tour_merch_settlements']['Row'],
): TourMerchSettlementRecord {
  return {
    id: row.id,
    stopId: row.stop_id,
    artistId: row.artist_id,
    settlement: row.settlement as unknown as MerchSettlement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type TourMerchItemInsert = Database['public']['Tables']['tour_merch_items']['Insert']
export type TourMerchItemUpdate = Database['public']['Tables']['tour_merch_items']['Update']

export async function createTourMerchItem(db: DbClient, data: TourMerchItemInsert): Promise<TourMerchItem> {
  const { data: row, error } = await db.from('tour_merch_items').insert(data).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createTourMerchItem')
  return rowToMerchItem(row)
}

export async function updateTourMerchItem(db: DbClient, id: string, data: TourMerchItemUpdate): Promise<TourMerchItem> {
  const { data: row, error } = await db.from('tour_merch_items').update(data).eq('id', id).select('*').single()
  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from updateTourMerchItem')
  return rowToMerchItem(row)
}

export async function deleteTourMerchItem(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('tour_merch_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getTourMerchItemsByArtistId(db: DbClient, artistId: string): Promise<TourMerchItem[]> {
  const { data, error } = await db
    .from('tour_merch_items')
    .select('*')
    .eq('artist_id', artistId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMerchItem)
}

export async function getTourMerchSettlementByStopId(
  db: DbClient,
  stopId: string,
  artistId?: string,
): Promise<TourMerchSettlementRecord | null> {
  let query = db.from('tour_merch_settlements').select('*').eq('stop_id', stopId)
  if (artistId) {
    query = query.eq('artist_id', artistId)
  }
  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToMerchSettlement(data) : null
}

export async function upsertTourMerchSettlement(
  db: DbClient,
  stopId: string,
  artistId: string,
  settlement: MerchSettlement,
): Promise<TourMerchSettlementRecord> {
  const { data, error } = await db
    .from('tour_merch_settlements')
    .upsert(
      { stop_id: stopId, artist_id: artistId, settlement: settlement as unknown as Database['public']['Tables']['tour_merch_settlements']['Insert']['settlement'] },
      { onConflict: 'stop_id,artist_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertTourMerchSettlement')
  return rowToMerchSettlement(data)
}