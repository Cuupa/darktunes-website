import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type SalesStatementRow = Database['public']['Tables']['sales_statements']['Row']
export type SalesStatementStatus = SalesStatementRow['status']

export interface SalesStatement {
  id: string
  artistId: string
  filename: string
  r2Key: string
  period: string
  amountEur: number | undefined
  status: SalesStatementStatus
  labelNotes: string | undefined
  labelApprovedAt: string | undefined
  createdAt: string
}

export interface CreateSalesStatementData {
  artistId: string
  filename: string
  r2Key: string
  period: string
  amountEur?: number | null
  periodStart?: string | null
  periodEnd?: string | null
  totalStreams?: number | null
  batchId?: string | null
}

function rowToSalesStatement(row: SalesStatementRow): SalesStatement {
  return {
    id: row.id,
    artistId: row.artist_id,
    filename: row.filename,
    r2Key: row.r2_key,
    period: row.period,
    amountEur: row.amount_eur ?? undefined,
    status: row.status,
    labelNotes: row.label_notes ?? undefined,
    labelApprovedAt: row.label_approved_at ?? undefined,
    createdAt: row.created_at,
  }
}

export async function createSalesStatement(
  db: DbClient,
  data: CreateSalesStatementData,
): Promise<SalesStatement> {
  const { data: row, error } = await db
    .from('sales_statements')
    .insert({
      artist_id: data.artistId,
      filename: data.filename,
      r2_key: data.r2Key,
      period: data.period,
      amount_eur: data.amountEur ?? null,
      period_start: data.periodStart ?? null,
      period_end: data.periodEnd ?? null,
      total_streams: data.totalStreams ?? 0,
      batch_id: data.batchId ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!row) throw new Error('No data returned from createSalesStatement')
  return rowToSalesStatement(row as SalesStatementRow)
}

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

export async function getSalesStatementById(
  db: DbClient,
  id: string,
  artistId?: string,
): Promise<SalesStatement | null> {
  let query = db.from('sales_statements').select('*').eq('id', id)

  if (artistId) {
    query = query.eq('artist_id', artistId)
  }

  const { data, error } = await query.single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return data ? rowToSalesStatement(data as SalesStatementRow) : null
}

export async function approveSalesStatement(
  db: DbClient,
  id: string,
  notes?: string,
): Promise<SalesStatement> {
  const { data: row, error } = await db
    .from('sales_statements')
    .update({
      status: 'label_approved',
      label_notes: notes?.trim() ? notes.trim() : null,
      label_approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToSalesStatement(row as SalesStatementRow)
}

export async function updateSalesStatementStatus(
  db: DbClient,
  id: string,
  status: SalesStatementStatus,
): Promise<SalesStatement> {
  const { data: row, error } = await db
    .from('sales_statements')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToSalesStatement(row as SalesStatementRow)
}

export async function getSalesSummariesForAdmin(
  db: DbClient,
  status?: SalesStatementStatus,
): Promise<SalesStatement[]> {
  let query = db.from('sales_statements').select('*').order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToSalesStatement(row as SalesStatementRow))
}
