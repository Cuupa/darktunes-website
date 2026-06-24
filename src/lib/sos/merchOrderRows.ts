/**
 * Build normalised merch order rows from raw SOS transactions (worker-safe).
 */

import type { SalesTransaction } from '@/lib/sos/ingest/csv-parser'

export interface MerchOrderRow {
  externalId: string
  artistName: string
  source: 'shopify' | 'darkmerch'
  period: string
  productTitle: string
  country: string
  quantity: number
  revenueEur: number
}

const VALID_MONTH_RE = /^\d{4}-\d{2}$/

export function buildMerchOrderRows(transactions: SalesTransaction[]): MerchOrderRow[] {
  const rows: MerchOrderRow[] = []

  for (const tx of transactions) {
    if (tx.source !== 'shopify' && tx.source !== 'darkmerch') continue
    if (!VALID_MONTH_RE.test(tx.sales_month)) continue

    rows.push({
      externalId: tx.id,
      artistName: tx.main_artist.trim() || tx.original_artist.trim(),
      source: tx.source,
      period: tx.sales_month,
      productTitle: tx.release_title.trim() || tx.track_title.trim() || 'Merchandise',
      country: tx.country.trim() || 'Unknown',
      quantity: tx.quantity,
      revenueEur: tx.net_revenue,
    })
  }

  return rows
}