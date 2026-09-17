/**
 * Period-lock guard for the SOS purge maintenance route (§A.5, §A.8.9):
 * locked or archived settlement periods are immutable, so purge must not
 * delete bronze batches or gold analytics that belong to them.
 *
 * Server-only module: it imports `BusinessRuleError` (next/server), so it must
 * never be imported by client components — `purgeSosData.ts` stays client-safe.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { BusinessRuleError } from '@/lib/errors'
import { listBronzeBatchesForPurge, type SosPurgeScope } from '@/lib/sos/purgeSosData'

type DbClient = SupabaseClient<Database>

export interface SettlementPeriodLock {
  id: string
  label: string
  periodStart: string
  periodEnd: string
  status: string
}

export interface PurgeLockConflict {
  periodId: string
  periodLabel: string
  target: string
}

const GOLD_PERIOD_TABLES = [
  { table: 'artist_territory_metrics', column: 'period' },
  { table: 'merch_orders', column: 'period' },
] as const

/** `YYYY-MM-DD` and `YYYY-MM` both collapse to the comparable `YYYY-MM` month. */
export function toPeriodMonth(value: string): string {
  return value.slice(0, 7)
}

/** Inclusive month list between two period bounds; capped to bound pathological ranges. */
export function monthsBetween(periodStart: string, periodEnd: string): string[] {
  const start = toPeriodMonth(periodStart)
  const end = toPeriodMonth(periodEnd)
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) {
    return [start]
  }

  const months: string[] = []
  let year = Number(start.slice(0, 4))
  let month = Number(start.slice(5, 7))
  const endYear = Number(end.slice(0, 4))
  const endMonth = Number(end.slice(5, 7))

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
    if (months.length > 600) break
  }
  return months
}

export function monthRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const aS = toPeriodMonth(aStart)
  const aE = toPeriodMonth(aEnd)
  const bS = toPeriodMonth(bStart)
  const bE = toPeriodMonth(bEnd)
  return aS <= bE && bS <= aE
}

export async function listNonWritableSettlementPeriods(
  db: DbClient,
): Promise<SettlementPeriodLock[]> {
  const { data, error } = await db
    .from('settlement_periods')
    .select('id, label, period_start, period_end, status')
    .in('status', ['locked', 'archived'])

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
  }))
}

async function findBronzeConflicts(
  db: DbClient,
  scope: Exclude<SosPurgeScope, 'gold'>,
  periods: SettlementPeriodLock[],
): Promise<PurgeLockConflict[]> {
  const batches = await listBronzeBatchesForPurge(db, scope)
  const conflicts: PurgeLockConflict[] = []

  for (const batch of batches) {
    const period = periods.find((p) =>
      monthRangesOverlap(batch.periodStart, batch.periodEnd, p.periodStart, p.periodEnd),
    )
    if (period) {
      conflicts.push({
        periodId: period.id,
        periodLabel: period.label,
        target: `distributor_import_batches/${batch.id}`,
      })
    }
  }

  return conflicts
}

async function findGoldConflicts(
  db: DbClient,
  periods: SettlementPeriodLock[],
): Promise<PurgeLockConflict[]> {
  const conflicts: PurgeLockConflict[] = []

  for (const period of periods) {
    const months = monthsBetween(period.periodStart, period.periodEnd)

    for (const check of GOLD_PERIOD_TABLES) {
      const { data, error } = await db
        .from(check.table)
        .select(check.column)
        .in(check.column, months)
        .limit(1)

      if (error) throw new Error(error.message)
      if ((data ?? []).length > 0) {
        conflicts.push({
          periodId: period.id,
          periodLabel: period.label,
          target: `${check.table} (${period.periodStart}..${period.periodEnd})`,
        })
      }
    }

    const { data: summaries, error: summaryError } = await db
      .from('sos_period_summaries')
      .select('period_start, period_end')

    if (summaryError) throw new Error(summaryError.message)
    const hasSummary = (summaries ?? []).some((row) =>
      monthRangesOverlap(row.period_start, row.period_end, period.periodStart, period.periodEnd),
    )
    if (hasSummary) {
      conflicts.push({
        periodId: period.id,
        periodLabel: period.label,
        target: `sos_period_summaries (${period.periodStart}..${period.periodEnd})`,
      })
    }
  }

  return conflicts
}

/**
 * Throws `BusinessRuleError` (409) when the requested purge scope contains data
 * of a locked or archived settlement period. `event_impact` is not period-scoped
 * and therefore not part of this guard.
 */
export async function assertSosPurgeAllowed(db: DbClient, scope: SosPurgeScope): Promise<void> {
  const periods = await listNonWritableSettlementPeriods(db)
  if (periods.length === 0) return

  const conflicts =
    scope === 'gold'
      ? await findGoldConflicts(db, periods)
      : await findBronzeConflicts(db, scope, periods)

  if (conflicts.length === 0) return

  const labels = [...new Set(conflicts.map((conflict) => conflict.periodLabel))]
  throw new BusinessRuleError(
    `Purge blocked: ${conflicts.length} object(s) belong to locked or archived settlement periods (${labels.join(', ')}). Locked periods are immutable; purge only data of writable periods.`,
    409,
    'SETTLEMENT_PERIOD_LOCKED',
  )
}
