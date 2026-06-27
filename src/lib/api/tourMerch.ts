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

export async function getTourMerchItemsByArtistId(db: DbClient, artistId: string): Promise<TourMerchItem[]> {
  const { data, error } = await db
    .from('tour_merch_items')
    .select('*')
    .eq('artist_id', artistId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMerchItem)
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
      { onConflict: 'stop_id' },
    )
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertTourMerchSettlement')
  return rowToMerchSettlement(data)
}