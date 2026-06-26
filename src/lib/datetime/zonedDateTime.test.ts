import { describe, it, expect } from 'vitest'
import {
  zonedLocalToUtcIso,
  utcIsoToZonedLocal,
  formatZonedDateTime,
} from './zonedDateTime'

describe('zonedLocalToUtcIso', () => {
  it('converts winter time in Europe/Berlin to UTC', () => {
    expect(zonedLocalToUtcIso('2026-01-15T14:30', 'Europe/Berlin')).toBe(
      '2026-01-15T13:30:00.000Z',
    )
  })

  it('converts summer time in Europe/Berlin to UTC', () => {
    expect(zonedLocalToUtcIso('2026-06-26T14:30', 'Europe/Berlin')).toBe(
      '2026-06-26T12:30:00.000Z',
    )
  })

  it('round-trips through utcIsoToZonedLocal', () => {
    const local = '2026-06-26T14:30'
    const utc = zonedLocalToUtcIso(local, 'Europe/Berlin')
    expect(utcIsoToZonedLocal(utc, 'Europe/Berlin')).toBe(local)
  })
})

describe('formatZonedDateTime', () => {
  it('includes short timezone name', () => {
    const formatted = formatZonedDateTime('2026-01-15T13:30:00.000Z', 'Europe/Berlin', 'de-DE')
    expect(formatted).toMatch(/15/)
    expect(formatted).toMatch(/01/)
    expect(formatted).toMatch(/2026/)
    expect(formatted).toMatch(/14:30/)
    expect(formatted).toMatch(/MEZ|GMT\+1/i)
  })
})