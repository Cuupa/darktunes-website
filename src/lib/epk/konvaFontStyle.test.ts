import { describe, expect, it } from 'vitest'
import { isItalicFontStyle, resolveKonvaFontStyle } from './konvaFontStyle'

describe('resolveKonvaFontStyle', () => {
  it('maps weight and italic like the PDF renderer', () => {
    expect(resolveKonvaFontStyle({ fontWeight: 700 })).toBe('bold')
    expect(resolveKonvaFontStyle({ fontWeight: 600 })).toBe('normal')
    expect(resolveKonvaFontStyle({ fontStyle: 'italic' })).toBe('italic')
    expect(resolveKonvaFontStyle({ fontWeight: 700, fontStyle: 'italic' })).toBe('italic bold')
    expect(isItalicFontStyle('bold italic')).toBe(true)
  })
})