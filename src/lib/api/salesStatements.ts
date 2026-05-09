/**
 * src/lib/api/salesStatements.ts
 *
 * Data Access Layer for the `sales_statements` table.
 *
 * Sales statements are royalty PDF documents stored privately in Cloudflare R2.
 * The DB stores only the R2 object key — actual downloads happen via short-lived
 * presigned URLs generated in a Server Action (never expose the R2 key to clients).
 *
 * RLS ensures artists can only read their own statement rows.
 * Only admins can insert statements (label-managed data).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type SalesStatementRow = Database['public']['Tables']['sales_statements']['Row']

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface SalesStatement {
  id: string
  artistId: string
  filename: string
  r2Key: string
  period: string
  amountEur: number | undefined
  createdAt: string
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToSalesStatement(row: SalesStatementRow): SalesStatement {
  return {
    id: row.id,
    artistId: row.artist_id,
    filename: row.filename,
    r2Key: row.r2_key,
    period: row.period,
    amountEur: row.amount_eur ?? undefined,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches all sales statements for a given artist, newest first.
 * RLS at the DB layer guarantees the artist only sees their own rows.
 */
export async function getSalesStatementsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<SalesStatement[]> {
  const { data, error } = await db
    .from('sales_statements')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToSalesStatement(row as SalesStatementRow))
}
