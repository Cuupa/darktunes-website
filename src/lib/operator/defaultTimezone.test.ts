import { describe, it, expect } from 'vitest'
import {
  resolveOperatorTimezone,
  getScheduleTimezoneOptions,
  DEFAULT_OPERATOR_TIMEZONE,
} from './defaultTimezone'

describe('resolveOperatorTimezone', () => {
  it('returns Europe/Berlin for German impressum address', () => {
    expect(
      resolveOperatorTimezone({
        impressumAddress: 'Friedhofweg 1\n69118 Heidelberg\nDeutschland',
        impressumVatId: '',
      }),
    ).toBe('Europe/Berlin')
  })

  it('returns Europe/Berlin from DE VAT ID when address is empty', () => {
    expect(
      resolveOperatorTimezone({
        impressumAddress: '',
        impressumVatId: 'DE269873706',
      }),
    ).toBe('Europe/Berlin')
  })

  it('returns Europe/Berlin from German PLZ pattern', () => {
    expect(
      resolveOperatorTimezone({
        impressumAddress: 'Musterstraße 1\n10115 Berlin',
        impressumVatId: '',
      }),
    ).toBe('Europe/Berlin')
  })

  it('falls back to SOS default address when impressum is empty', () => {
    expect(resolveOperatorTimezone({ impressumAddress: '', impressumVatId: '' })).toBe(
      'Europe/Berlin',
    )
  })

  it('returns null-settings fallback', () => {
    expect(resolveOperatorTimezone(null)).toBe(DEFAULT_OPERATOR_TIMEZONE)
  })
})

describe('getScheduleTimezoneOptions', () => {
  it('lists operator timezone first without duplicates', () => {
    const options = getScheduleTimezoneOptions('Europe/Berlin')
    expect(options[0].value).toBe('Europe/Berlin')
    expect(options.filter((o) => o.value === 'Europe/Berlin')).toHaveLength(1)
  })

  it('prepends unknown operator timezone', () => {
    const options = getScheduleTimezoneOptions('Asia/Tokyo')
    expect(options[0].value).toBe('Asia/Tokyo')
    expect(options.some((o) => o.value === 'Europe/Berlin')).toBe(true)
  })
})