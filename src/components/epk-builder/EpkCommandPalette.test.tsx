import { describe, expect, it } from 'vitest'
import { EpkCommandPalette, EPK_OPEN_COMMAND_PALETTE_EVENT } from './EpkCommandPalette'

describe('EpkCommandPalette', () => {
  it('exports component and event constant', () => {
    expect(EpkCommandPalette).toBeTypeOf('function')
    expect(EPK_OPEN_COMMAND_PALETTE_EVENT).toBe('epk-open-command-palette')
  })
})
