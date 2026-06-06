/**
 * src/lib/portal/invoiceNumber.ts
 *
 * Sequential invoice number generator in the format DT-{YEAR}-{NNNN}.
 *
 * Numbers are sequential per artist per calendar year.
 * Gaps are impossible because MAX+1 is used as the next number.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

/**
 * Generate the next invoice number for the given artist in the given year.
 *
 * Reads the maximum existing invoice number for artist+year and increments it.
 * Thread-safety is acceptable here because invoice creation is low-frequency
 * and backed by the `UNIQUE` constraint on `invoice_number`.
 *
 * @example `DT-2025-0001`, `DT-2025-0002`, …
 */
export async function generateInvoiceNumber(
  supabase: DbClient,
  artistId: string,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const prefix = `DT-${year}-`

  const { data, error } = await supabase
    .from('artist_invoices')
    .select('invoice_number')
    .eq('artist_id', artistId)
    .ilike('invoice_number', `${prefix}%`)
    .order('invoice_number', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to query invoice numbers: ${error.message}`)
  }

  let next = 1
  if (data && data.length > 0) {
    const last = data[0].invoice_number
    const seq = parseInt(last.slice(prefix.length), 10)
    if (!isNaN(seq)) next = seq + 1
  }

  return `${prefix}${String(next).padStart(4, '0')}`
}
