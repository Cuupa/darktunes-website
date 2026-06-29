import { describe, expect, it } from 'vitest'
import { fontCacheKey, isBoldFontWeight, resolveFontWeight } from './embedDocumentFonts'
import { parsePrimaryFontFamily } from '@/lib/epk/fontFamily'

describe('embedDocumentFonts helpers', () => {
  it('builds stable cache keys', () => {
    expect(fontCacheKey('Inter', 700)).toBe('Inter:700')
  })

  it('detects bold weights', () => {
    expect(isBoldFontWeight('bold')).toBe(true)
    expect(isBoldFontWeight(700)).toBe(true)
    expect(isBoldFontWeight(600)).toBe(false)
    expect(isBoldFontWeight(400)).toBe(false)
  })

  it('resolves primary families from stacks for embedding', () => {
    expect(parsePrimaryFontFamily('Inter, Helvetica, Arial, sans-serif')).toBe('Inter')
    expect(resolveFontWeight(600)).toBe(600)
  })
})