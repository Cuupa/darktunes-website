import { isValidIsoDateRange } from './accountingInputValidation'

/**
 * Server-side gate for statement publication. The client sends the resolved
 * accounting period; the server re-validates it against the persisted request
 * instead of trusting client-side release flags (contract §A.7/#616).
 */
export interface StatementUploadPeriodInput {
  period?: string
  periodStart?: string
  periodEnd?: string
}

export type StatementUploadPeriodError = 'period_required' | 'period_invalid' | 'period_mismatch'

export type StatementUploadPeriodValidation =
  | { ok: true; periodStart: string; periodEnd: string; period: string }
  | { ok: false; error: StatementUploadPeriodError; message: string }

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function validateStatementUploadPeriod(
  input: StatementUploadPeriodInput,
): StatementUploadPeriodValidation {
  const periodStart = (input.periodStart ?? '').trim()
  const periodEnd = (input.periodEnd ?? '').trim()
  const period = (input.period ?? '').trim()

  if (!periodStart || !periodEnd || !period) {
    return {
      ok: false,
      error: 'period_required',
      message: 'A valid billing period is required to publish a statement.',
    }
  }

  if (!isValidIsoDateRange(periodStart, periodEnd)) {
    return {
      ok: false,
      error: 'period_invalid',
      message: `Invalid billing period "${periodStart}" – "${periodEnd}".`,
    }
  }

  if (!MONTH_RE.test(period) || period !== periodStart.slice(0, 7)) {
    return {
      ok: false,
      error: 'period_mismatch',
      message: `Statement period "${period}" does not match the billing period starting ${periodStart}.`,
    }
  }

  return { ok: true, periodStart, periodEnd, period }
}

export interface StatementSourceBatch {
  id: string
  periodStart: string
  periodEnd: string
  status: string
  fileHash?: string
}

export type StatementSourceArchiveError =
  | 'source_archive_incomplete'
  | 'source_manifest_mismatch'
  | 'source_batch_invalid'
  | 'source_primary_batch_invalid'

export function validateStatementSourceArchive(input: {
  sourceMode: 'bronze' | 'manual'
  sourceBatchIds: string[]
  workspaceBatchIds: string[]
  batches: StatementSourceBatch[]
  primaryBatchId?: string
  periodStart: string
  periodEnd: string
}): { ok: true } | { ok: false; error: StatementSourceArchiveError; message: string } {
  const requestedIds = [...new Set(input.sourceBatchIds)]
  const workspaceIds = [...new Set(input.workspaceBatchIds)]
  const reject = (
    error: StatementSourceArchiveError,
    message: string,
  ): { ok: false; error: StatementSourceArchiveError; message: string } => ({
    ok: false,
    error,
    message,
  })

  if (input.sourceMode === 'manual') {
    if (requestedIds.length || input.primaryBatchId) {
      return reject(
        'source_manifest_mismatch',
        'This statement uses the manual PDF-only path and cannot link distributor sources.',
      )
    }
    return { ok: true }
  }

  if (requestedIds.length === 0 || workspaceIds.length === 0) {
    return reject(
      'source_archive_incomplete',
      'Save and archive all source files before creating a statement.',
    )
  }
  if (
    requestedIds.length !== input.sourceBatchIds.length ||
    workspaceIds.length !== input.workspaceBatchIds.length ||
    requestedIds.some((id) => !workspaceIds.includes(id))
  ) {
    return reject(
      'source_manifest_mismatch',
      'Save the source list to this workspace before publishing the statement.',
    )
  }
  if (input.batches.length !== requestedIds.length) {
    return reject(
      'source_archive_incomplete',
      'One or more source archives are missing. Load or archive them before publishing.',
    )
  }

  const periodStartMonth = input.periodStart.slice(0, 7)
  const periodEndMonth = input.periodEnd.slice(0, 7)
  const batchById = new Map(input.batches.map((batch) => [batch.id, batch]))
  for (const id of requestedIds) {
    const batch = batchById.get(id)
    const sourceStartMonth = batch?.periodStart.slice(0, 7) ?? ''
    const sourceEndMonth = batch?.periodEnd.slice(0, 7) ?? ''
    const sourcePeriodOverlaps =
      /^\d{4}-(0[1-9]|1[0-2])$/.test(sourceStartMonth) &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(sourceEndMonth) &&
      sourceStartMonth <= periodEndMonth &&
      sourceEndMonth >= periodStartMonth
    if (
      !batch ||
      batch.status !== 'completed' ||
      !batch.fileHash ||
      !sourcePeriodOverlaps
    ) {
      return reject(
        'source_batch_invalid',
        'A source archive is incomplete, unverified, or belongs to another period.',
      )
    }
  }

  if (input.primaryBatchId && !requestedIds.includes(input.primaryBatchId)) {
    return reject(
      'source_primary_batch_invalid',
      'The statement source link does not match the saved source list.',
    )
  }
  return { ok: true }
}
