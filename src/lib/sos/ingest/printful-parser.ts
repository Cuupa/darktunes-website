/**
 * printful-parser.ts
 *
 * Parses Printful orders export CSVs into raw cost entries that can be
 * reconciled with Shopify orders in ecommerce-merger.ts.
 *
 * Expected Printful CSV columns (from real export):
 *   Order   → orderId (e.g. "#DM1063")
 *   Total   → production + shipping cost (e.g. "€15.79" — currency symbol stripped)
 *   Status  → order status (informational)
 *   Date    → fulfilment date (informational)
 *   Address → shipping address (informational)
 */

import Papa from 'papaparse'
import type { PrintfulRawCost } from './ecommerce-merger'
import { parseAmount } from './amountParsing'
import { normalizeDateToMonth } from './normalizeDateToMonth'

export interface PrintfulParseResult {
  costs: PrintfulRawCost[]
  errors: Array<{ row: number; reason: string; data: string }>
  /** Observed fulfilment months used for source archive bounds. */
  periodMonths: string[]
}

/**
 * Parses a Printful orders export CSV into raw cost records.
 *
 * The `Total` column contains a currency symbol (e.g. `€15.79`) which is
 * stripped during parsing. Only rows with a non-empty `Order` column are
 * included; summary or footer rows are silently skipped.
 *
 * @param content - Raw CSV file content string.
 * @returns Parsed cost records and any row-level parse errors.
 */
export function parsePrintfulCSV(content: string): PrintfulParseResult {
  const stripped = content.startsWith('\uFEFF') ? content.slice(1) : content

  const parsed = Papa.parse<Record<string, string>>(stripped.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  const costs: PrintfulRawCost[] = []
  const errors: PrintfulParseResult['errors'] = []
  const periodMonths: string[] = []

  // A number without an explicit currency is not safe to reconcile.

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i]

    try {
      // Printful exports use "Order" as the column header
      const orderId = row['Order']?.trim()
      if (!orderId) continue

      const totalRaw = row['Total'] ?? ''
      const rawCurrency = (row['Currency'] ?? row['Total Currency'] ?? '').trim().toUpperCase()
      const amountCurrency = /\b([A-Z]{3})\b/i.exec(totalRaw)?.[1]?.toUpperCase()
      const symbols = [
        totalRaw.includes('€') ? 'EUR' : null,
        totalRaw.includes('£') ? 'GBP' : null,
        totalRaw.includes('¥') ? 'JPY' : null,
      ].filter((value): value is string => value !== null)
      const currencies = [rawCurrency || null, amountCurrency ?? null, ...symbols]
        .filter((value): value is string => value !== null)
      if (currencies.some(value => !/^[A-Z]{3}$/.test(value)) || new Set(currencies).size > 1) {
        errors.push({
          row: i + 2,
          reason: 'Conflicting or invalid Printful currency',
          data: JSON.stringify(row),
        })
        continue
      }
      // Dollar symbols alone are ambiguous between multiple currencies.
      const currency = currencies[0]
      const amountText = amountCurrency ? totalRaw.replace(/\b[A-Z]{3}\b/i, '') : totalRaw
      const totalResult = parseAmount(amountText, 'en')
      if (totalResult.kind !== 'valid') {
        errors.push({
          row: i + 2,
          reason: `Invalid "Total" value "${row['Total'] ?? ''}" (${totalResult.kind === 'invalid' ? totalResult.reason : 'empty'})`,
          data: JSON.stringify(row),
        })
        continue
      }

      costs.push({ orderId, total: totalResult.value, ...(currency ? { currency } : {}) })
      const month = normalizeDateToMonth(row['Date'] ?? '', 'printful')
      if (month) periodMonths.push(month)
    } catch (err) {
      errors.push({
        row: i + 2,
        reason: err instanceof Error ? err.message : 'Unknown error',
        data: JSON.stringify(row),
      })
    }
  }

  return { costs, errors, periodMonths }
}
