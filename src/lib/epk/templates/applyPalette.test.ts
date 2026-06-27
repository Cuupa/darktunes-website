import { describe, expect, it } from 'vitest'
import { applyPaletteToDocument, getDocumentPaletteId } from './applyPalette'
import { BUILTIN_EPK_TEMPLATES } from './starterTemplates'

describe('applyPaletteToDocument', () => {
  it('recolors classic template with arctic palette', () => {
    const template = BUILTIN_EPK_TEMPLATES[0]
    const recolored = applyPaletteToDocument(template.document, 'arctic')

    expect(recolored.pages[0]?.background.color).toBe('#f4f6f8')
    expect(getDocumentPaletteId(recolored)).toBe('arctic')

    const artistName = recolored.elements.find((el) => el.role === 'artist-name')
    expect(artistName?.style.fill).toBe('#1a1a2e')
  })

  it('recolors header band with surface color', () => {
    const template = BUILTIN_EPK_TEMPLATES[0]
    const recolored = applyPaletteToDocument(template.document, 'neon')

    const header = recolored.elements.find((el) => el.role === 'header-band')
    expect(header?.style.fill).toBe('#120818')
  })

  it('falls back to darktunes for unknown palette id', () => {
    const template = BUILTIN_EPK_TEMPLATES[0]
    const recolored = applyPaletteToDocument(template.document, 'unknown-palette')
    expect(recolored.pages[0]?.background.color).toBe('#101010')
  })
})