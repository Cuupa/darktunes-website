import { describe, expect, it } from 'vitest'
import {
  parseAmount,
  parseIntegerAmount,
  SOURCE_AMOUNT_CONVENTION,
} from './amountParsing'

describe('parseAmount — fixed values from issue #632', () => {
  it('parses DE decimal comma correctly (regression: old parser returned 1579)', () => {
    // The removed `parseCurrencyAmount` stripped the comma in its default path
    // and returned 1579 for "15,79".
    expect(parseAmount('15,79', 'de')).toEqual({ kind: 'valid', value: 15.79 })
    expect(parseAmount('-15,79', 'de')).toEqual({ kind: 'valid', value: -15.79 })
    expect(parseAmount('1.234,56', 'de')).toEqual({ kind: 'valid', value: 1234.56 })
    expect(parseAmount('0,00', 'de')).toEqual({ kind: 'valid', value: 0 })
  })

  it('parses EN values correctly', () => {
    expect(parseAmount('15.79', 'en')).toEqual({ kind: 'valid', value: 15.79 })
    expect(parseAmount('1,234.56', 'en')).toEqual({ kind: 'valid', value: 1234.56 })
    expect(parseAmount('-15.79', 'en')).toEqual({ kind: 'valid', value: -15.79 })
  })

  it('rejects the other convention instead of guessing', () => {
    expect(parseAmount('15.79', 'de').kind).toBe('invalid')
    expect(parseAmount('15,79', 'en').kind).toBe('invalid')
    expect(parseAmount('1,234.56', 'de').kind).toBe('invalid')
    expect(parseAmount('1.234,56', 'en').kind).toBe('invalid')
  })

  it('treats a lone three-digit group as ambiguous without a profile', () => {
    expect(parseAmount('1,234')).toEqual({
      kind: 'invalid',
      reason: 'ambiguous',
      raw: '1,234',
    })
    expect(parseAmount('1.234')).toEqual({
      kind: 'invalid',
      reason: 'ambiguous',
      raw: '1.234',
    })
    // With an explicit convention it is a valid number.
    expect(parseAmount('1,234', 'en')).toEqual({ kind: 'valid', value: 1234 })
    expect(parseAmount('1.234', 'de')).toEqual({ kind: 'valid', value: 1234 })
  })

  it('rejects empty, malformed and non-finite values — never 0', () => {
    for (const raw of ['', '   ', 'abc', '12x', 'NaN', 'Infinity', '-Infinity', '1,23,4']) {
      const result = parseAmount(raw)
      expect(result.kind).not.toBe('valid')
    }
    expect(parseAmount('')).toEqual({ kind: 'empty' })
    expect(parseAmount('abc').kind).toBe('invalid')
    expect(parseAmount('12x').kind).toBe('invalid')
    expect(parseAmount('NaN').kind).toBe('invalid')
  })

  it('treats a separator with 4+ digits as an unambiguous decimal in auto mode', () => {
    expect(parseAmount('1.2345')).toEqual({ kind: 'valid', value: 1.2345 })
    expect(parseAmount('12,3456')).toEqual({ kind: 'valid', value: 12.3456 })
  })

  it('strips currency symbols and whitespace', () => {
    expect(parseAmount('€15.79', 'en')).toEqual({ kind: 'valid', value: 15.79 })
    expect(parseAmount(' 1,234.56 $ ', 'en')).toEqual({ kind: 'valid', value: 1234.56 })
    expect(parseAmount('1.234,56 €', 'de')).toEqual({ kind: 'valid', value: 1234.56 })
  })

  it('supports scientific notation per convention', () => {
    expect(parseAmount('3.495e-4', 'en')).toEqual({ kind: 'valid', value: 3.495e-4 })
    expect(parseAmount('0.019046400000', 'en')).toEqual({
      kind: 'valid',
      value: 0.0190464,
    })
    expect(parseAmount('3,495e-4', 'de')).toEqual({ kind: 'valid', value: 3.495e-4 })
    expect(parseAmount('3.495e-4', 'de').kind).toBe('invalid')
  })

  it('keeps signs and plain integers', () => {
    expect(parseAmount('-0.032494271000', 'en')).toEqual({
      kind: 'valid',
      value: -0.032494271,
    })
    expect(parseAmount('+5', 'en')).toEqual({ kind: 'valid', value: 5 })
    expect(parseAmount('--5')).toEqual({ kind: 'invalid', reason: 'malformed', raw: '--5' })
  })

  it('maps every ingest source to its convention', () => {
    expect(SOURCE_AMOUNT_CONVENTION).toEqual({
      believe: 'en',
      bandcamp: 'en',
      shopify: 'en',
      printful: 'en',
      darkmerch: 'de',
    })
  })
})

describe('parseIntegerAmount', () => {
  it('accepts integers, zero and negative refunds', () => {
    expect(parseIntegerAmount('8')).toEqual({ kind: 'valid', value: 8 })
    expect(parseIntegerAmount('-1')).toEqual({ kind: 'valid', value: -1 })
    expect(parseIntegerAmount('0')).toEqual({ kind: 'valid', value: 0 })
  })

  it('rejects decimals, malformed text and empty as invalid/empty', () => {
    expect(parseIntegerAmount('1.5').kind).toBe('invalid')
    expect(parseIntegerAmount('12x').kind).toBe('invalid')
    expect(parseIntegerAmount('abc').kind).toBe('invalid')
    expect(parseIntegerAmount('')).toEqual({ kind: 'empty' })
    expect(parseIntegerAmount(null)).toEqual({ kind: 'empty' })
  })
})
