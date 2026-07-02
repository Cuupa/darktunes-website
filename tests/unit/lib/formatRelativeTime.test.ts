import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

describe('formatRelativeTime', () => {
  const now = new Date('2026-07-02T12:00:00Z').getTime()

  it('formats minutes ago in English', () => {
    const result = formatRelativeTime('2026-07-02T11:30:00Z', 'en', now)
    expect(result).toMatch(/30 minutes ago|half an hour ago/i)
  })

  it('formats hours ago in German', () => {
    const result = formatRelativeTime('2026-07-02T09:00:00Z', 'de', now)
    expect(result).toMatch(/3 Stunden|vor 3 Stunden/i)
  })

  it('returns empty string for invalid dates', () => {
    expect(formatRelativeTime('invalid', 'en', now)).toBe('')
  })
})