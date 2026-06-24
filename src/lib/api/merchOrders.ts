/**
 * DAL for normalised merch order line items (merch_orders table).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { MerchOrderRow } from '@/lib/sos/merchOrderRows'

type DbClient = SupabaseClient<Database>

export interface MerchOrder {
  id: string
  artistId: string
  source: 'shopify' | 'darkmerch'
  externalId: string
  period: string
  productTitle: string
  country: string
  quantity: number
  revenueEur: number
  sourceBatchId: string | null
  createdAt: string
}

export interface MerchOrderStats {
  totalOrders: number
  totalQuantity: number
  totalRevenueEur: number
  bySource: Record<'shopify' | 'darkmerch', number>
  topProducts: Array<{ productTitle: string; quantity: number; revenueEur: number }>
  byPeriod: Array<{ period: string; revenueEur: number; quantity: number }>
}

function mapRow(row: Database['public']['Tables']['merch_orders']['Row']): MerchOrder {
  return {
    id: row.id,
    artistId: row.artist_id,
    source: row.source,
    externalId: row.external_id,
    period: row.period,
    productTitle: row.product_title,
    country: row.country,
    quantity: row.quantity,
    revenueEur: Number(row.revenue_eur),
    sourceBatchId: row.source_batch_id,
    createdAt: row.created_at,
  }
}

export async function upsertMerchOrders(
  db: DbClient,
  rows: Array<MerchOrderRow & { artistId: string; sourceBatchId?: string | null }>,
): Promise<number> {
  if (rows.length === 0) return 0

  const payload = rows.map((row) => ({
    artist_id: row.artistId,
    source: row.source,
    external_id: row.externalId,
    period: row.period,
    product_title: row.productTitle,
    country: row.country,
    quantity: row.quantity,
    revenue_eur: row.revenueEur,
    source_batch_id: row.sourceBatchId ?? null,
  }))

  const { error } = await db.from('merch_orders').upsert(payload, {
    onConflict: 'source,external_id',
  })

  if (error) throw new Error(error.message)
  return rows.length
}

export async function getMerchOrdersByArtistId(
  db: DbClient,
  artistId: string,
): Promise<MerchOrder[]> {
  const { data, error } = await db
    .from('merch_orders')
    .select('*')
    .eq('artist_id', artistId)
    .order('period', { ascending: false })
    .limit(2000)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

export function computeMerchOrderStats(orders: MerchOrder[]): MerchOrderStats {
  const bySource: Record<'shopify' | 'darkmerch', number> = { shopify: 0, darkmerch: 0 }
  const productMap = new Map<string, { quantity: number; revenueEur: number }>()
  const periodMap = new Map<string, { revenueEur: number; quantity: number }>()

  let totalQuantity = 0
  let totalRevenueEur = 0

  for (const order of orders) {
    totalQuantity += order.quantity
    totalRevenueEur += order.revenueEur
    bySource[order.source] += 1

    const product = productMap.get(order.productTitle) ?? { quantity: 0, revenueEur: 0 }
    product.quantity += order.quantity
    product.revenueEur += order.revenueEur
    productMap.set(order.productTitle, product)

    const period = periodMap.get(order.period) ?? { revenueEur: 0, quantity: 0 }
    period.revenueEur += order.revenueEur
    period.quantity += order.quantity
    periodMap.set(order.period, period)
  }

  const topProducts = [...productMap.entries()]
    .map(([productTitle, stats]) => ({ productTitle, ...stats }))
    .sort((a, b) => b.revenueEur - a.revenueEur)
    .slice(0, 15)

  const byPeriod = [...periodMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([period, stats]) => ({ period, ...stats }))

  return {
    totalOrders: orders.length,
    totalQuantity,
    totalRevenueEur,
    bySource,
    topProducts,
    byPeriod,
  }
}