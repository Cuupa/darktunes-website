/**
 * Server-side Bronze CSV re-processing: R2 → parse → territory metrics.
 */

import type { SalesTransaction } from './ingest/csv-parser'
import { parseCSVContentStreaming } from './ingest/streaming-csv-parser'
import { parseShopifyCSV } from './ingest/shopify-parser'
import { parseDarkmerchCSV } from './ingest/darkmerch-parser'
import {
  aggregateTerritoryMetrics,
  type TerritoryMetricRow,
} from './data-processor'
import type { BronzeDistributor } from './bronzeUpload'

function groupTransactionsByArtist(
  transactions: SalesTransaction[],
): Array<{ artist: string; transactions: SalesTransaction[] }> {
  const map = new Map<string, SalesTransaction[]>()
  for (const t of transactions) {
    const artist = t.main_artist?.trim() || t.original_artist?.trim() || 'Unknown'
    const key = artist.toLowerCase()
    const group = map.get(key) ?? []
    group.push({ ...t, main_artist: artist })
    map.set(key, group)
  }
  return Array.from(map.entries()).map(([, txs]) => ({
    artist: txs[0]?.main_artist ?? 'Unknown',
    transactions: txs,
  }))
}

async function parseBronzeCsvContent(
  distributor: BronzeDistributor,
  csvContent: string,
): Promise<SalesTransaction[]> {
  if (distributor === 'shopify') {
    return parseShopifyCSV(csvContent).transactions
  }
  if (distributor === 'printful') {
    return []
  }
  if (distributor === 'darkmerch') {
    return parseDarkmerchCSV(csvContent).transactions
  }
  const result = await parseCSVContentStreaming(
    csvContent,
    distributor === 'bandcamp' ? 'bandcamp' : 'believe',
  )
  return result.transactions
}

export interface BronzeReprocessResult {
  rowCount: number
  territoryMetrics: TerritoryMetricRow[]
  uniqueArtists: string[]
}

/**
 * Parses archived Bronze CSV text and produces gold-layer territory metrics.
 */
export async function reprocessBronzeCsvContent(
  distributor: BronzeDistributor,
  csvContent: string,
): Promise<BronzeReprocessResult> {
  const transactions = await parseBronzeCsvContent(distributor, csvContent)
  const artistData = groupTransactionsByArtist(transactions)
  const territoryMetrics = aggregateTerritoryMetrics(artistData)

  return {
    rowCount: transactions.length,
    territoryMetrics,
    uniqueArtists: artistData.map((a) => a.artist).sort(),
  }
}