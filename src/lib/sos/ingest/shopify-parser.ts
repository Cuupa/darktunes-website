/**
 * shopify-parser.ts
 *
 * Parses Shopify orders export CSVs.
 *
 * ## Architecture
 * The primary export is now `parseShopifyRaw` which returns structured raw
 * order data (grouped by order ID, with all line items). The `reconcile-
 * MerchTransactions` function in `ecommerce-merger.ts` then takes this raw
 * data, matches it with Printful costs, and produces the final SalesTransactions
 * with artist attribution derived from product names.
 *
 * `parseShopifyCSV` is retained as a legacy wrapper for the worker's
 * fallback path (when no Printful data is available), but no longer attributes
 * everything to "Merch (Shopify)" — it delegates to the merger with an empty
 * Printful costs array.
 *
 * Expected Shopify CSV columns (from real export):
 *   Name              → orderId (e.g. "#DM1121") — one order = multiple rows
 *   Paid at           → sales_month date
 *   Subtotal          → order subtotal (only on first row of each order)
 *   Currency          → ISO currency code
 *   Billing Country   → country code
 *   Lineitem name     → product name (artist extracted from this)
 *   Lineitem sku      → SKU / catalog reference
 *   Lineitem quantity → units ordered
 *   Lineitem price    → per-unit selling price
 */

import { parseShopifyRaw, reconcileMerchTransactions } from './ecommerce-merger'
import type { SalesTransaction } from './csv-parser'

export type { ShopifyRawOrder, ShopifyRawLineItem } from './ecommerce-merger'

export interface ShopifyParseResult {
  transactions: SalesTransaction[]
  errors: Array<{ row: number; reason: string; data: string }>
}

/**
 * Backward-compatible Shopify parser.
 *
 * Parses the raw Shopify CSV and reconciles it without Printful costs
 * (net revenue = full subtotal per artist). This path is used when:
 *  - Only Shopify data is available (no Printful file uploaded).
 *  - The worker processes a Shopify file before any Printful file arrives.
 *
 * When Printful data is also available, the worker calls `parseShopifyRaw`
 * and `parsePrintfulCSV` separately and runs `reconcileMerchTransactions`
 * with both datasets.
 *
 * @param content - Raw Shopify orders CSV content.
 * @returns SalesTransaction array with artist attribution from product names.
 */
export function parseShopifyCSV(content: string): ShopifyParseResult {
  const { orders, errors } = parseShopifyRaw(content)
  const { transactions } = reconcileMerchTransactions(orders, [])
  return { transactions, errors }
}

