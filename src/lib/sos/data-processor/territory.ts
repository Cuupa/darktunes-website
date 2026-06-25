import { convertToEur } from '../currency'
import type { ExchangeRates, HistoricalRates } from '../currency'
import type { ProcessedArtistData, TerritoryMetricRow } from './types'

const VALID_TERRITORY_MONTH_RE = /^\d{4}-\d{2}$/

/**
 * Aggregates distributor transactions into monthly territory metrics per artist.
 */
export function aggregateTerritoryMetrics(
  artistData: Pick<ProcessedArtistData, 'artist' | 'transactions'>[],
  exchangeRates: ExchangeRates = {},
  historicalExchangeRates: HistoricalRates = {},
): TerritoryMetricRow[] {
  const bucket = new Map<string, TerritoryMetricRow>()

  for (const { artist, transactions } of artistData) {
    for (const t of transactions) {
      if (!t.country || !VALID_TERRITORY_MONTH_RE.test(t.sales_month)) continue

      const applicableRates =
        t.sales_month && historicalExchangeRates[t.sales_month]
          ? historicalExchangeRates[t.sales_month]
          : exchangeRates
      const revenueEur =
        t.source === 'bandcamp' && t.currency !== 'EUR'
          ? convertToEur(t.net_revenue, t.currency, applicableRates)
          : t.net_revenue

      const streams =
        !t.is_physical && t.is_download === false ? t.quantity : 0
      const platform = t.platform || 'Unknown'
      const country = t.country.trim()
      const key = `${artist.toLowerCase()}|${t.sales_month}|${platform}|${country.toLowerCase()}`

      const existing = bucket.get(key)
      if (existing) {
        existing.streams += streams
        existing.revenueEur += revenueEur
        existing.quantity += t.quantity
      } else {
        bucket.set(key, {
          artistName: artist,
          period: t.sales_month,
          platform,
          country,
          streams,
          revenueEur,
          quantity: t.quantity,
        })
      }
    }
  }

  return Array.from(bucket.values())
}