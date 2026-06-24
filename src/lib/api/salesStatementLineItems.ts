/**
 * src/lib/api/salesStatementLineItems.ts — SOS statement detail rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['sales_statement_line_items']['Row']

export interface SalesStatementLineItem {
  id: string
  statementId: string
  releaseId: string | undefined
  platform: string | undefined
  country: string | undefined
  streams: number
  revenueEur: number
  quantity: number
  createdAt: string
}

export interface CreateLineItemInput {
  statementId: string
  releaseId?: string | null
  platform?: string | null
  country?: string | null
  streams?: number
  revenueEur?: number
  quantity?: number
}

function rowToLineItem(row: Row): SalesStatementLineItem {
  return {
    id: row.id,
    statementId: row.statement_id,
    releaseId: row.release_id ?? undefined,
    platform: row.platform ?? undefined,
    country: row.country ?? undefined,
    streams: row.streams,
    revenueEur: Number(row.revenue_eur),
    quantity: row.quantity,
    createdAt: row.created_at,
  }
}

export async function createSalesStatementLineItems(
  db: DbClient,
  items: CreateLineItemInput[],
): Promise<SalesStatementLineItem[]> {
  if (items.length === 0) return []

  const payload = items.map((item) => ({
    statement_id: item.statementId,
    release_id: item.releaseId ?? null,
    platform: item.platform ?? null,
    country: item.country ?? null,
    streams: item.streams ?? 0,
    revenue_eur: item.revenueEur ?? 0,
    quantity: item.quantity ?? 0,
  }))

  const { data, error } = await db.from('sales_statement_line_items').insert(payload).select()
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToLineItem(row as Row))
}

export async function getLineItemsByStatementId(
  db: DbClient,
  statementId: string,
): Promise<SalesStatementLineItem[]> {
  const { data, error } = await db
    .from('sales_statement_line_items')
    .select('*')
    .eq('statement_id', statementId)
    .order('revenue_eur', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToLineItem(row as Row))
}

export interface ArtistLineItemWithContext extends SalesStatementLineItem {
  periodStart: string | undefined
  periodEnd: string | undefined
  releaseTitle: string | undefined
  releaseIsrc: string | undefined
}

/**
 * All SOS line items for an artist (via sales_statements), with release metadata.
 */
export async function getLineItemsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ArtistLineItemWithContext[]> {
  const { data: statements, error: stmtError } = await db
    .from('sales_statements')
    .select('id, period_start, period_end')
    .eq('artist_id', artistId)

  if (stmtError) throw new Error(stmtError.message)
  if (!statements?.length) return []

  const periodByStatement = new Map(
    statements.map((s) => [
      s.id,
      { periodStart: s.period_start ?? undefined, periodEnd: s.period_end ?? undefined },
    ]),
  )
  const statementIds = statements.map((s) => s.id)

  const { data, error } = await db
    .from('sales_statement_line_items')
    .select('*, releases(title, isrc)')
    .in('statement_id', statementIds)
    .order('revenue_eur', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((raw) => {
    const row = raw as Row & {
      releases: { title: string; isrc: string | null } | null
    }
    const period = periodByStatement.get(row.statement_id)
    const base = rowToLineItem(row)
    return {
      ...base,
      periodStart: period?.periodStart,
      periodEnd: period?.periodEnd,
      releaseTitle: row.releases?.title ?? undefined,
      releaseIsrc: row.releases?.isrc ?? undefined,
    }
  })
}