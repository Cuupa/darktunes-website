/**
 * DAL for the read-only SOS settlement data audit (§E.3).
 *
 * Every query is a `select`; the scan never writes. Rows are bounded per table
 * (`rowLimit`); when a bound is hit the report is flagged `truncated` instead of
 * silently dropping data.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  buildSettlementAuditReport,
  type ArtifactCheck,
  type AuditCategory,
  type CarryForwardSnapshot,
  type ImportBatchSnapshot,
  type InvoiceSnapshot,
  type LedgerEntrySnapshot,
  type SettlementAuditReport,
  type SettlementOperationSnapshot,
  type SettlementPeriodSnapshot,
  type StatementSnapshot,
} from '@/lib/api/settlementAuditCore'

type DbClient = SupabaseClient<Database>

export const AUDIT_DEFAULT_ROW_LIMIT = 5000
export const AUDIT_MAX_ROW_LIMIT = 20000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const INCOMPLETE_BATCH_STATUSES = ['uploaded', 'processing', 'failed'] as const

export interface SettlementAuditScanOptions {
  periodId?: string | null
  rowLimit?: number
  categories?: AuditCategory[]
  generatedAt?: string
  artifactChecks?: ArtifactCheck[]
  orphanPdfObjectKeys?: string[]
}

interface BoundedResult<T> {
  rows: T[]
  truncated: boolean
}

function bound<T>(rows: T[] | null, limit: number): BoundedResult<T> {
  const list = rows ?? []
  if (list.length > limit) {
    return { rows: list.slice(0, limit), truncated: true }
  }
  return { rows: list, truncated: false }
}

export function encodeAuditCursor(findingId: string): string {
  return Buffer.from(`after:${findingId}`, 'utf8').toString('base64url')
}

export function decodeAuditCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    if (!decoded.startsWith('after:')) return null
    const id = decoded.slice('after:'.length)
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

async function loadPeriods(db: DbClient): Promise<SettlementPeriodSnapshot[]> {
  const { data, error } = await db
    .from('settlement_periods')
    .select('id, label, period_start, period_end, status')
    .order('period_start', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
  }))
}

async function loadStatements(
  db: DbClient,
  periodId: string | null,
  limit: number,
): Promise<BoundedResult<StatementSnapshot>> {
  let query = db
    .from('sales_statements')
    .select(
      'id, artist_id, settlement_period_id, period_start, period_end, status, is_archived, amount_eur, first_viewed_at, created_at',
    )
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (periodId) {
    query = query.or(`settlement_period_id.eq.${periodId},settlement_period_id.is.null`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const bounded = bound(data, limit)
  return {
    truncated: bounded.truncated,
    rows: bounded.rows.map((row) => ({
      id: row.id,
      artistId: row.artist_id,
      settlementPeriodId: row.settlement_period_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      isArchived: row.is_archived ?? false,
      amountEur: Number(row.amount_eur ?? 0),
      firstViewedAt: row.first_viewed_at,
      createdAt: row.created_at,
    })),
  }
}

async function loadInvoices(
  db: DbClient,
  periodId: string | null,
  limit: number,
): Promise<BoundedResult<InvoiceSnapshot>> {
  let query = db
    .from('artist_invoices')
    .select(
      'id, artist_id, statement_id, status, settlement_period_id, service_period_start, service_period_end, pdf_url, pdf_sha256, delivery_status, delivery_attempted_at, paid_amount_cents, outstanding_amount_cents, updated_at',
    )
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (periodId) {
    query = query.or(`settlement_period_id.eq.${periodId},settlement_period_id.is.null`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const bounded = bound(data, limit)
  return {
    truncated: bounded.truncated,
    rows: bounded.rows.map((row) => ({
      id: row.id,
      artistId: row.artist_id,
      statementId: row.statement_id,
      status: row.status,
      settlementPeriodId: row.settlement_period_id,
      servicePeriodStart: row.service_period_start,
      servicePeriodEnd: row.service_period_end,
      pdfUrl: row.pdf_url,
      pdfSha256: row.pdf_sha256,
      deliveryStatus: row.delivery_status ?? 'not_sent',
      deliveryAttemptedAt: row.delivery_attempted_at,
      paidAmountCents: row.paid_amount_cents,
      outstandingAmountCents: row.outstanding_amount_cents,
      updatedAt: row.updated_at,
    })),
  }
}

async function loadLedgerEntries(
  db: DbClient,
  periodId: string | null,
  limit: number,
): Promise<BoundedResult<LedgerEntrySnapshot>> {
  let query = db
    .from('artist_settlement_ledger')
    .select(
      'id, artist_id, settlement_period_id, entry_type, amount_eur, reference_type, reference_id, created_at',
    )
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (periodId) {
    query = query.or(`settlement_period_id.eq.${periodId},settlement_period_id.is.null`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const bounded = bound(data, limit)
  return {
    truncated: bounded.truncated,
    rows: bounded.rows.map((row) => ({
      id: row.id,
      artistId: row.artist_id,
      settlementPeriodId: row.settlement_period_id,
      entryType: row.entry_type,
      amountEur: Number(row.amount_eur ?? 0),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      createdAt: row.created_at,
    })),
  }
}

async function loadCarryForwards(
  db: DbClient,
  periodId: string | null,
  limit: number,
): Promise<BoundedResult<CarryForwardSnapshot>> {
  let query = db
    .from('period_carry_forwards')
    .select(
      'id, from_period_id, to_period_id, artist_id, opening_balance_eur, applied_at, created_at',
    )
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (periodId) {
    query = query.or(`from_period_id.eq.${periodId},to_period_id.eq.${periodId}`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const bounded = bound(data, limit)
  return {
    truncated: bounded.truncated,
    rows: bounded.rows.map((row) => ({
      id: row.id,
      fromPeriodId: row.from_period_id,
      toPeriodId: row.to_period_id,
      artistId: row.artist_id,
      openingBalanceEur: Number(row.opening_balance_eur ?? 0),
      appliedAt: row.applied_at,
      createdAt: row.created_at,
    })),
  }
}

async function loadIncompleteBatches(
  db: DbClient,
  limit: number,
): Promise<BoundedResult<ImportBatchSnapshot>> {
  const { data, error } = await db
    .from('distributor_import_batches')
    .select('id, status, file_hash, period_start, period_end, created_at')
    .in('status', [...INCOMPLETE_BATCH_STATUSES])
    .order('created_at', { ascending: true })
    .limit(limit + 1)

  if (error) throw new Error(error.message)

  const bounded = bound(data, limit)
  return {
    truncated: bounded.truncated,
    rows: bounded.rows.map((row) => ({
      id: row.id,
      status: row.status,
      fileHash: row.file_hash,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      createdAt: row.created_at,
    })),
  }
}

async function loadOperations(
  db: DbClient,
  limit: number,
): Promise<BoundedResult<SettlementOperationSnapshot>> {
  const { data, error } = await db
    .from('settlement_operations')
    .select('id, operation_type, resource_type, resource_id, status, payload_hash, created_at')
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (error) throw new Error(error.message)

  const bounded = bound(data, limit)
  return {
    truncated: bounded.truncated,
    rows: bounded.rows.map((row) => ({
      id: row.id,
      operationType: row.operation_type,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      status: row.status,
      payloadHash: row.payload_hash,
      createdAt: row.created_at,
    })),
  }
}

export async function scanSettlementAudit(
  db: DbClient,
  options: SettlementAuditScanOptions = {},
): Promise<SettlementAuditReport> {
  const periodId = options.periodId ?? null
  if (periodId && !UUID_PATTERN.test(periodId)) {
    throw new Error('Invalid period id')
  }

  const rowLimit = Math.min(
    Math.max(options.rowLimit ?? AUDIT_DEFAULT_ROW_LIMIT, 1),
    AUDIT_MAX_ROW_LIMIT,
  )

  const periods = await loadPeriods(db)
  const statements = await loadStatements(db, periodId, rowLimit)
  const invoices = await loadInvoices(db, periodId, rowLimit)
  const ledgerEntries = await loadLedgerEntries(db, periodId, rowLimit)
  const carryForwards = await loadCarryForwards(db, periodId, rowLimit)
  const importBatches = await loadIncompleteBatches(db, rowLimit)
  const operations = await loadOperations(db, rowLimit)

  const truncated =
    statements.truncated ||
    invoices.truncated ||
    ledgerEntries.truncated ||
    carryForwards.truncated ||
    importBatches.truncated ||
    operations.truncated

  return buildSettlementAuditReport({
    periods,
    statements: statements.rows,
    invoices: invoices.rows,
    ledgerEntries: ledgerEntries.rows,
    carryForwards: carryForwards.rows,
    importBatches: importBatches.rows,
    operations: operations.rows,
    artifactChecks: options.artifactChecks,
    orphanPdfObjectKeys: options.orphanPdfObjectKeys,
    categories: options.categories,
    scopePeriodId: periodId,
    generatedAt: options.generatedAt,
    truncated,
  })
}
