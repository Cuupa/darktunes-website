import { describe, it, expect } from 'vitest'
import {
  validateEanChecksum,
  parseDateDmyToIso,
  parseDurationToSeconds,
  validateFieldValue,
  normalizeFieldValue,
} from './fieldValidation'

describe('fieldValidation', () => {
  it('validates EAN-13 checksum', () => {
    expect(validateEanChecksum('4006381333931')).toBe(true)
    expect(validateEanChecksum('4006381333932')).toBe(false)
  })

  it('parses DD/MM/YYYY to ISO', () => {
    expect(parseDateDmyToIso('31/12/2024')).toBe('2024-12-31')
    expect(parseDateDmyToIso('32/12/2024')).toBeNull()
  })

  it('parses duration HH:MM:SS', () => {
    expect(parseDurationToSeconds('1:02:03')).toBe(3723)
    expect(parseDurationToSeconds('99:99:99')).toBeNull()
  })

  it('validateFieldValue returns null for valid ISRC', () => {
    expect(validateFieldValue('isrc', 'DE-A12-24-00001')).toBeNull()
    expect(validateFieldValue('isrc', 'invalid')).not.toBeNull()
  })

  it('normalizeFieldValue converts duration to seconds', () => {
    expect(normalizeFieldValue('duration', '0:03:30')).toBe(210)
  })
})