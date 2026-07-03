import { describe, expect, it } from 'vitest'
import { EpkContextMenu, EpkCanvasContextMenu } from './EpkContextMenu'

describe('EpkContextMenu', () => {
  it('exports components', () => {
    expect(EpkContextMenu).toBeTypeOf('function')
    expect(EpkCanvasContextMenu).toBeTypeOf('function')
  })
})
