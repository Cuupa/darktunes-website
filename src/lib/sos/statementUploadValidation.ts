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

export function validateStatementSourceArchive(input: {
  sourceFileCount?: number
  archivedFileCount?: number
}): { ok: true } | { ok: false; error: 'source_archive_incomplete'; message: string } {
  const sourceFileCount = input.sourceFileCount ?? 0
  const archivedFileCount = input.archivedFileCount ?? 0
  if (sourceFileCount <= 0) return { ok: true }
  if (archivedFileCount >= sourceFileCount) return { ok: true }
  return {
    ok: false,
    error: 'source_archive_incomplete',
    message: 'All uploaded source files must be archived before creating a statement.',
  }
}
