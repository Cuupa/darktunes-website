import { describe, expect, it } from 'vitest'
import { buildPeriodLabel, isPeriodWritable } from './settlementPeriods'

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