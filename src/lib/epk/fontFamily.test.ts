import { describe, expect, it } from 'vitest'
import {
  FALLBACK_FONT_FAMILY,
  isBoldFontWeight,
  parsePrimaryFontFamily,
  resolveFontWeight,
} from './fontFamily'

describe('parsePrimaryFontFamily', () => {
  it('returns fallback for empty or system stacks', () => {
    expect(parsePrimaryFontFamily()).toBe(FALLBACK_FONT_FAMILY)
    expect(parsePrimaryFontFamily('Helvetica, Arial, sans-serif')).toBe(FALLBACK_FONT_FAMILY)
    expect(parsePrimaryFontFamily('Helvetica')).toBe(FALLBACK_FONT_FAMILY)
  })

  it('extracts the first non-generic family from CSS stacks', () => {
    expect(parsePrimaryFontFamily('Inter, Helvetica, Arial, sans-serif')).toBe('Inter')
    expect(parsePrimaryFontFamily('Playfair Display, Georgia, serif')).toBe('Playfair Display')
    expect(parsePrimaryFontFamily('"Space Grotesk", Helvetica, Arial, sans-serif')).toBe(
      'Space Grotesk',
    )
  })
})

describe('resolveFontWeight', () => {
  it('maps weights to embed buckets', () => {
    expect(resolveFontWeight('bold')).toBe(700)
    expect(resolveFontWeight(700)).toBe(700)
    expect(resolveFontWeight(600)).toBe(600)
    expect(resolveFontWeight(400)).toBe(400)
    expect(isBoldFontWeight(600)).toBe(false)
    expect(isBoldFontWeight(700)).toBe(true)
  })
})