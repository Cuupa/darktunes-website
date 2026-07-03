import { describe, expect, it } from 'vitest'
import { EpkFontLoader, EPK_FONTS_LOADED_EVENT } from './EpkFontLoader'

describe('EpkFontLoader', () => {
  it('exports component and event constant', () => {
    expect(EpkFontLoader).toBeTypeOf('function')
    expect(EPK_FONTS_LOADED_EVENT).toBe('epk-fonts-loaded')
  })
})
