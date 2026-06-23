import { describe, it, expect } from 'vitest'
import { convertToEur } from './currency'
import type { ExchangeRates } from './currency'

const RATES: ExchangeRates = {
  USD: 1.08,
  GBP: 0.86,
}

describe('convertToEur', () => {
  it('returns the original amount unchanged for EUR', () => {
    expect(convertToEur(100, 'EUR', RATES)).toBe(100)
    expect(convertToEur(100, 'eur', RATES)).toBe(100)
    expect(convertToEur(100, '  EUR  ', RATES)).toBe(100)
  })

  it('converts a known foreign currency to EUR', () => {
    // 108 USD / 1.08 = 100 EUR
    expect(convertToEur(108, 'USD', RATES)).toBeCloseTo(100, 5)
    // 86 GBP / 0.86 = 100 EUR
    expect(convertToEur(86, 'GBP', RATES)).toBeCloseTo(100, 5)
  })

  it('is case-insensitive for the currency code', () => {
    expect(convertToEur(108, 'usd', RATES)).toBeCloseTo(100, 5)
    expect(convertToEur(108, 'Usd', RATES)).toBeCloseTo(100, 5)
  })

  it('throws when the currency has no rate instead of returning 0', () => {
    expect(() => convertToEur(500, 'XYZ', RATES)).toThrowError(/XYZ/)
    expect(() => convertToEur(500, 'JPY', RATES)).toThrowError(/JPY/)
  })

  it('throws for a zero or negative rate entry', () => {
    const badRates: ExchangeRates = { USD: 0, GBP: -1.5 }
    expect(() => convertToEur(100, 'USD', badRates)).toThrowError(/USD/)
    expect(() => convertToEur(100, 'GBP', badRates)).toThrowError(/GBP/)
  })

  it('throws for an empty currency string (no silent fallback)', () => {
    // code becomes '' after trim+upper → early return with original amount
    // This is the existing "no currency" short-circuit and should stay safe.
    expect(convertToEur(100, '', RATES)).toBe(100)
  })
})
