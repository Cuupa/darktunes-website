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
import { parseCurrencyAmount } from './ecommerce-merger'

export interface PrintfulParseResult {
  costs: PrintfulRawCost[]
  errors: Array<{ row: number; reason: string; data: string }>
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

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i]

    try {
      // Printful exports use "Order" as the column header
      const orderId = row['Order']?.trim()
      if (!orderId) continue

      const total = parseCurrencyAmount(row['Total'] ?? '')

      costs.push({ orderId, total })
    } catch (err) {
      errors.push({
        row: i + 2,
        reason: err instanceof Error ? err.message : 'Unknown error',
        data: JSON.stringify(row),
      })
    }
  }

  return { costs, errors }
}
