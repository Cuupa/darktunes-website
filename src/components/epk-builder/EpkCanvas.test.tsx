import { describe, expect, it } from 'vitest'
import { EpkCanvas } from './EpkCanvas'

describe('EpkCanvas', () => {
  it('exports component', () => {
    expect(EpkCanvas).toBeTypeOf('function')
  })
})
