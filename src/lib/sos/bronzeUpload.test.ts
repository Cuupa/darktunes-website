import { describe, it, expect } from 'vitest'
import { extractPeriodBounds } from './bronzeUpload'

describe('extractPeriodBounds', () => {
  it('returns min and max valid YYYY-MM months', () => {
    expect(extractPeriodBounds(['2024-03', '2024-01', 'invalid', '2024-06'])).toEqual({
      periodStart: '2024-01',
      periodEnd: '2024-06',
    })
  })

  it('falls back to current month when no valid months', () => {
    const fallback = new Date().toISOString().slice(0, 7)
    expect(extractPeriodBounds(['Unknown', ''])).toEqual({
      periodStart: fallback,
      periodEnd: fallback,
    })
  })
})