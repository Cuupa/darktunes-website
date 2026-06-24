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