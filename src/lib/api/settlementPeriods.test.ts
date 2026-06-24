import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  assertSettlementPeriodWritable,
  assertSettlementPeriodWritableById,
  buildPeriodLabel,
  isPeriodWritable,
  SettlementPeriodNotWritableError,
} from './settlementPeriods'

type DbClient = SupabaseClient<Database>

describe('settlementPeriods helpers', () => {
  it('builds a single-month label when start equals end', () => {
    expect(buildPeriodLabel('2025-10-01', '2025-10-01')).toBe('2025-10-01')
  })

  it('builds a range label for multi-month periods', () => {
    expect(buildPeriodLabel('2025-10-01', '2026-03-31')).toBe('2025-10-01 – 2026-03-31')
  })

  it('treats open and under_review periods as writable', () => {
    expect(isPeriodWritable('open')).toBe(true)
    expect(isPeriodWritable('under_review')).toBe(true)
    expect(isPeriodWritable('approved')).toBe(true)
    expect(isPeriodWritable('locked')).toBe(false)
    expect(isPeriodWritable('archived')).toBe(false)
  })
})

describe('assertSettlementPeriodWritable', () => {
  it('allows mutations when no period row exists yet', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as DbClient

    await expect(
      assertSettlementPeriodWritable(db, '2025-01-01', '2025-03-31'),
    ).resolves.toBeUndefined()
  })

  it('rejects locked periods', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { status: 'locked' }, error: null }),
      }),
    } as unknown as DbClient

    await expect(
      assertSettlementPeriodWritable(db, '2025-01-01', '2025-03-31'),
    ).rejects.toBeInstanceOf(SettlementPeriodNotWritableError)
  })
})

describe('assertSettlementPeriodWritableById', () => {
  it('rejects archived periods', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'period-1',
            period_start: '2025-01-01',
            period_end: '2025-03-31',
            label: '2025-01-01 – 2025-03-31',
            status: 'archived',
            notes: null,
            locked_at: '2025-04-01T00:00:00Z',
            locked_by: 'user-1',
            archived_at: '2025-05-01T00:00:00Z',
            archived_by: 'user-1',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-05-01T00:00:00Z',
          },
          error: null,
        }),
      }),
    } as unknown as DbClient

    await expect(assertSettlementPeriodWritableById(db, 'period-1')).rejects.toBeInstanceOf(
      SettlementPeriodNotWritableError,
    )
  })
})