import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { appendLedgerEntry } from '@/lib/api/settlementLedger'
import { getOrCreateSettlementPeriod } from '@/lib/api/settlementPeriods'

type DbClient = SupabaseClient<Database>
type SalesStatementRow = Database['public']['Tables']['sales_statements']['Row']
export type SalesStatementStatus = SalesStatementRow['status']

export type SalesStatementDocumentType = SalesStatementRow['document_type']

export interface SalesStatement {
  id: string
  artistId: string
  filename: string
  r2Key: string
  period: string
  periodStart: string | undefined
  periodEnd: string | undefined
  amountEur: number | undefined
  status: SalesStatementStatus
  labelNotes: string | undefined
  labelApprovedAt: string | undefined
  firstViewedAt: string | undefined
  lastViewedAt: string | undefined
  viewCount: number
  settlementPeriodId: string | undefined
  documentType: SalesStatementDocumentType
  correctionOfId: string | undefined
  isArchived: boolean
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
    periodStart: row.period_start ?? undefined,
    periodEnd: row.period_end ?? undefined,
    amountEur: row.amount_eur ?? undefined,
    status: row.status,
    labelNotes: row.label_notes ?? undefined,
    labelApprovedAt: row.label_approved_at ?? undefined,
    firstViewedAt: row.first_viewed_at ?? undefined,
    lastViewedAt: row.last_viewed_at ?? undefined,
    viewCount: row.view_count ?? 0,
    settlementPeriodId: row.settlement_period_id ?? undefined,
    documentType: row.document_type ?? 'original',
    correctionOfId: row.correction_of_id ?? undefined,
    isArchived: row.is_archived ?? false,
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

export interface ApproveSalesStatementResult {
  statement: SalesStatement
  emailSent: boolean
  emailError?: string
}

export async function approveAndNotifySalesStatement(
  db: DbClient,
  id: string,
  notify: (statement: SalesStatement) => Promise<{ success: boolean; error?: string }>,
  notes?: string,
): Promise<ApproveSalesStatementResult> {
  const approved = await approveSalesStatement(db, id, notes)
  const emailResult = await notify(approved)

  if (emailResult.success) {
    const notified = await updateSalesStatementStatus(db, id, 'artist_notified')
    return { statement: notified, emailSent: true }
  }

  return {
    statement: approved,
    emailSent: false,
    emailError: emailResult.error,
  }
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

export async function getSalesStatementsForPeriod(
  db: DbClient,
  periodStart: string,
  periodEnd: string,
): Promise<SalesStatementRow[]> {
  const { data, error } = await db
    .from('sales_statements')
    .select('*')
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .neq('document_type', 'storno')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as SalesStatementRow[]
}

export async function linkApprovedStatementToSettlement(
  db: DbClient,
  statement: SalesStatement,
  actorId: string,
): Promise<void> {
  if (statement.amountEur == null || !statement.periodStart || !statement.periodEnd) return

  const period = await getOrCreateSettlementPeriod(db, statement.periodStart, statement.periodEnd)

  await db
    .from('sales_statements')
    .update({ settlement_period_id: period.id })
    .eq('id', statement.id)

  // Correction drafts already book the payout delta when created (if the original
  // was on the settlement ledger). Approving must not add a second full payout.
  if (statement.documentType === 'correction' && statement.correctionOfId) {
    const { data: original, error } = await db
      .from('sales_statements')
      .select('settlement_period_id')
      .eq('id', statement.correctionOfId)
      .single()

    if (!error && original?.settlement_period_id) {
      return
    }
  }

  await appendLedgerEntry(db, {
    artistId: statement.artistId,
    settlementPeriodId: period.id,
    entryType: 'statement_payout',
    amountEur: statement.amountEur,
    referenceType: 'sales_statement',
    referenceId: statement.id,
    description: `Statement payout ${statement.period}`,
    createdBy: actorId,
  })
}

const CORRECTABLE_STATUSES: SalesStatementStatus[] = [
  'label_approved',
  'artist_notified',
  'viewed',
  'invoiced',
  'acknowledged',
]

export interface CreateCorrectionStatementInput {
  amountEur: number
  labelNotes?: string
}

export async function createCorrectionStatement(
  db: DbClient,
  originalId: string,
  input: CreateCorrectionStatementInput,
  actorId: string,
): Promise<SalesStatement> {
  const { data: original, error: fetchError } = await db
    .from('sales_statements')
    .select('*')
    .eq('id', originalId)
    .single()

  if (fetchError) throw new Error(fetchError.message)
  if (!original) throw new Error('Statement not found')

  const originalRow = original as SalesStatementRow
  if (!CORRECTABLE_STATUSES.includes(originalRow.status)) {
    throw new Error(`Cannot correct statement in status "${originalRow.status}"`)
  }
  if (originalRow.document_type === 'storno') {
    throw new Error('Cannot correct a storno document')
  }

  const { data: correctionRow, error: insertError } = await db
    .from('sales_statements')
    .insert({
      artist_id: originalRow.artist_id,
      filename: originalRow.filename.replace(/\.pdf$/i, '') + '-Korrektur.pdf',
      r2_key: originalRow.r2_key,
      period: originalRow.period,
      amount_eur: input.amountEur,
      status: 'draft',
      label_notes: input.labelNotes?.trim() || null,
      period_start: originalRow.period_start,
      period_end: originalRow.period_end,
      total_streams: originalRow.total_streams,
      batch_id: originalRow.batch_id,
      document_type: 'correction',
      correction_of_id: originalId,
      version: (originalRow.version ?? 1) + 1,
      reporting_currency: originalRow.reporting_currency,
      amount_reporting: originalRow.amount_reporting,
      fx_rate_to_eur: originalRow.fx_rate_to_eur,
      fx_rate_date: originalRow.fx_rate_date,
      fx_source: originalRow.fx_source,
      settlement_period_id: originalRow.settlement_period_id,
    })
    .select('*')
    .single()

  if (insertError) throw new Error(insertError.message)

  const { error: supersedeError } = await db
    .from('sales_statements')
    .update({
      status: 'superseded',
      superseded_by_id: correctionRow.id,
    })
    .eq('id', originalId)

  if (supersedeError) throw new Error(supersedeError.message)

  if (originalRow.settlement_period_id) {
    const delta = input.amountEur - Number(originalRow.amount_eur ?? 0)
    if (Math.abs(delta) >= 0.005) {
      await appendLedgerEntry(db, {
        artistId: originalRow.artist_id,
        settlementPeriodId: originalRow.settlement_period_id,
        entryType: 'correction',
        amountEur: delta,
        referenceType: 'sales_statement',
        referenceId: correctionRow.id,
        description: `Statement correction ${originalRow.period}`,
        createdBy: actorId,
      })
    }
  }

  return rowToSalesStatement(correctionRow as SalesStatementRow)
}

export async function recordStatementView(
  db: DbClient,
  id: string,
  artistId: string,
): Promise<SalesStatement> {
  const existing = await getSalesStatementById(db, id, artistId)
  if (!existing) throw new Error('Statement not found')

  const now = new Date().toISOString()
  const nextStatus =
    existing.status === 'artist_notified' || existing.status === 'label_approved'
      ? 'viewed'
      : existing.status

  const { data, error } = await db
    .from('sales_statements')
    .update({
      first_viewed_at: existing.firstViewedAt ?? now,
      last_viewed_at: now,
      view_count: (existing.viewCount ?? 0) + 1,
      status: nextStatus,
    })
    .eq('id', id)
    .eq('artist_id', artistId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToSalesStatement(data as SalesStatementRow)
}
