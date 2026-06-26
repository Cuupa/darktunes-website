import { describe, it, expect } from 'vitest'
import { buildPublishedAtFields } from './publishedAtFields'

describe('buildPublishedAtFields', () => {
  it('stores timezone only for scheduled posts', () => {
    const result = buildPublishedAtFields(
      {
        publishedAt: '2026-06-26T14:30',
        publishedAtTimezone: 'Europe/Berlin',
        status: 'scheduled',
      },
      { impressumAddress: '69118 Heidelberg, Deutschland', impressumVatId: '' },
    )

    expect(result.published_at).toBe('2026-06-26T12:30:00.000Z')
    expect(result.published_at_timezone).toBe('Europe/Berlin')
  })

  it('clears timezone for non-scheduled posts', () => {
    const result = buildPublishedAtFields(
      {
        publishedAt: '2026-06-26T14:30',
        publishedAtTimezone: 'Europe/Berlin',
        status: 'published',
      },
      null,
    )

    expect(result.published_at_timezone).toBeNull()
  })

  it('falls back to operator timezone for conversion', () => {
    const result = buildPublishedAtFields(
      {
        publishedAt: '2026-01-15T14:30',
        publishedAtTimezone: '',
        status: 'draft',
      },
      { impressumAddress: '', impressumVatId: 'DE269873706' },
    )

    expect(result.published_at).toBe('2026-01-15T13:30:00.000Z')
    expect(result.published_at_timezone).toBeNull()
  })
})