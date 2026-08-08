import { describe, expect, it } from 'vitest'
import {
  clampPercent,
  compareYearMonth,
  formatIbanDisplay,
  isValidEmail,
  isValidIsoDate,
  isValidPeriodRange,
  isValidYearMonth,
  parseMoneyAmount,
  parseOptionalPercent,
  parsePositiveInt,
  parseRequiredPercent,
} from './accountingInputValidation'

describe('accountingInputValidation', () => {
  it('clamps and parses percents', () => {
    expect(clampPercent(150)).toBe(100)
    expect(clampPercent(-5)).toBe(0)
    expect(parseRequiredPercent('50').ok).toBe(true)
    expect(parseRequiredPercent('12,5')).toEqual({ ok: true, value: 12.5 })
    expect(parseRequiredPercent('101').ok).toBe(false)
    const emptyOptional = parseOptionalPercent('')
    expect(emptyOptional.ok).toBe(true)
    if (emptyOptional.ok) expect(emptyOptional.value).toBeUndefined()
  })

  it('parses money amounts with 2-decimal rule', () => {
    expect(parseMoneyAmount('12.50')).toEqual({ ok: true, value: 12.5 })
    expect(parseMoneyAmount('12,50')).toEqual({ ok: true, value: 12.5 })
    expect(parseMoneyAmount('12.')).toEqual({ ok: true, value: 12 })
    expect(parseMoneyAmount('0', { allowZero: true })).toEqual({ ok: true, value: 0 })
    expect(parseMoneyAmount('0').ok).toBe(false)
    expect(parseMoneyAmount('1.234').ok).toBe(false)
    expect(parseMoneyAmount('abc').ok).toBe(false)
  })

  it('validates periods and dates', () => {
    expect(isValidYearMonth('2025-01')).toBe(true)
    expect(isValidYearMonth('2025-13')).toBe(false)
    expect(compareYearMonth('2025-01', '2025-03')).toBeLessThan(0)
    expect(isValidPeriodRange('2025-01', '2025-03')).toBe(true)
    expect(isValidPeriodRange('2025-03', '2025-01')).toBe(false)
    expect(isValidIsoDate('2025-02-28')).toBe(true)
    expect(isValidIsoDate('2025-02-30')).toBe(false)
  })

  it('validates email, ints, and formats IBAN', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
    expect(parsePositiveInt('25', { min: 1, max: 365 })).toEqual({ ok: true, value: 25 })
    expect(parsePositiveInt('0', { min: 1, max: 365 }).ok).toBe(false)
    expect(formatIbanDisplay('de89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
  })
})
