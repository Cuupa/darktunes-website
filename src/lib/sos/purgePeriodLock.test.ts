import { describe, expect, it, vi } from 'vitest'
import { BusinessRuleError } from '@/lib/errors'
import {
  assertSosPurgeAllowed,
  monthRangesOverlap,
  monthsBetween,
  toPeriodMonth,
} from './purgePeriodLock'

interface GuardDbOptions {
  periods?: Array<{
    id: string
    label: string
    period_start: string
    period_end: string
    status: string
  }>
  batches?: Array<{
    id: string
    r2_key: string
    status: string
    period_start: string
    period_end: string
  }>
  metricsRows?: Array<{ period: string }>
  merchRows?: Array<{ period: string }>
  summaries?: Array<{ period_start: string; period_end: string }>
}

function makeDb(options: GuardDbOptions = {}) {
  const periods = options.periods ?? []
  const batches = options.batches ?? []
  const metrics = options.metricsRows ?? []
  const merch = options.merchRows ?? []
  const summaries = options.summaries ?? []

  const from = vi.fn((table: string) => {
    if (table === 'settlement_periods') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: periods, error: null })),
        })),
      }
    }
    if (table === 'distributor_import_batches') {
      const result = { data: batches, error: null }
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => result),
          then: (resolve: (value: typeof result) => unknown) => resolve(result),
        })),
      }
    }
    if (table === 'sos_period_summaries') {
      const result = { data: summaries, error: null }
      return {
        select: vi.fn(() => ({
          then: (resolve: (value: typeof result) => unknown) => resolve(result),
        })),
      }
    }
    const rows = table === 'artist_territory_metrics' ? metrics : merch
    return {
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          limit: vi.fn(async () => ({ data: rows, error: null })),
        })),
      })),
    }
  })

  return { from } as never
}

const lockedPeriod = {
  id: 'period-locked',
  label: '2025-10-01 – 2026-03-31',
  period_start: '2025-10-01',
  period_end: '2026-03-31',
  status: 'locked',
}

describe('period month helpers', () => {
  it('collapses dates and months to comparable YYYY-MM values', () => {
    expect(toPeriodMonth('2025-10-01')).toBe('2025-10')
    expect(toPeriodMonth('2025-10')).toBe('2025-10')
  })

  it('expands a period range into inclusive months across year boundaries', () => {
    expect(monthsBetween('2025-10-01', '2026-02-28')).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('detects overlapping month ranges', () => {
    expect(monthRangesOverlap('2025-12-01', '2026-01-31', '2025-10-01', '2026-03-31')).toBe(true)
    expect(monthRangesOverlap('2025-01-01', '2025-02-28', '2025-10-01', '2026-03-31')).toBe(false)
  })
})

describe('assertSosPurgeAllowed', () => {
  it('allows the purge when no locked or archived period exists', async () => {
    const db = makeDb({
      batches: [{ id: 'b1', r2_key: 'k', status: 'failed', period_start: '2025-12', period_end: '2025-12' }],
    })
    await expect(assertSosPurgeAllowed(db, 'failed_bronze')).resolves.toBeUndefined()
  })

  it('blocks bronze purge when a batch overlaps a locked period', async () => {
    const db = makeDb({
      periods: [lockedPeriod],
      batches: [
        { id: 'b1', r2_key: 'k', status: 'failed', period_start: '2025-12', period_end: '2026-01' },
      ],
    })

    await expect(assertSosPurgeAllowed(db, 'failed_bronze')).rejects.toMatchObject({
      name: 'BusinessRuleError',
      status: 409,
      code: 'SETTLEMENT_PERIOD_LOCKED',
    })
  })

  it('allows bronze purge for batches outside every locked period', async () => {
    const db = makeDb({
      periods: [lockedPeriod],
      batches: [
        { id: 'b1', r2_key: 'k', status: 'failed', period_start: '2025-01', period_end: '2025-02' },
      ],
    })
    await expect(assertSosPurgeAllowed(db, 'bronze')).resolves.toBeUndefined()
  })

  it('blocks gold purge when gold rows exist in a locked period', async () => {
    const db = makeDb({
      periods: [lockedPeriod],
      metricsRows: [{ period: '2025-12' }],
    })

    await expect(assertSosPurgeAllowed(db, 'gold')).rejects.toBeInstanceOf(BusinessRuleError)
  })

  it('blocks gold purge when a period summary overlaps a locked period', async () => {
    const db = makeDb({
      periods: [lockedPeriod],
      summaries: [{ period_start: '2025-10', period_end: '2026-03' }],
    })

    await expect(assertSosPurgeAllowed(db, 'gold')).rejects.toMatchObject({
      status: 409,
      code: 'SETTLEMENT_PERIOD_LOCKED',
    })
  })

  it('allows gold purge when locked periods have no gold data left', async () => {
    const db = makeDb({
      periods: [lockedPeriod],
      metricsRows: [],
      merchRows: [],
      summaries: [],
    })
    await expect(assertSosPurgeAllowed(db, 'gold')).resolves.toBeUndefined()
  })
})
