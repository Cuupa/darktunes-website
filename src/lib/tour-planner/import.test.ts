import { describe, expect, it } from 'vitest'
import { parseCSVText } from '@/lib/tour-planner/import'

describe('parseCSVText', () => {
  it('parses a minimal DE header CSV', () => {
    const csv = `Datum;Venue;Stadt;Land
2026-10-01;Columbiahalle;Berlin;Germany`
    const stops = parseCSVText(csv)
    expect(stops).toHaveLength(1)
    expect(stops[0].date).toBe('2026-10-01')
    expect(stops[0].venueCity).toBe('Berlin')
  })
})