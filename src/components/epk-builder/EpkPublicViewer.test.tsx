import { describe, expect, it } from 'vitest'
import { EpkPublicViewer } from './EpkPublicViewer'

describe('EpkPublicViewer', () => {
  it('exports component', () => {
    expect(EpkPublicViewer).toBeTypeOf('function')
  })
})
