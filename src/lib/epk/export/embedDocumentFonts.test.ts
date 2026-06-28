import { describe, expect, it } from 'vitest'
import { fontCacheKey, isBoldFontWeight } from './embedDocumentFonts'

describe('embedDocumentFonts helpers', () => {
  it('builds stable cache keys', () => {
    expect(fontCacheKey('Inter', 700)).toBe('Inter:700')
  })

  it('detects bold weights', () => {
    expect(isBoldFontWeight('bold')).toBe(true)
    expect(isBoldFontWeight(700)).toBe(true)
    expect(isBoldFontWeight(400)).toBe(false)
  })
})