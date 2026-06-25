import { describe, expect, it } from 'vitest'
import { formatCurrency, isCompilationRelease } from './shared'

describe('export shared helpers', () => {
  it('formats EUR currency in de-DE locale', () => {
    expect(formatCurrency(1234.5)).toMatch(/1\.234,50/)
    expect(formatCurrency(1234.5)).toContain('€')
  })

  it('detects compilation releases by EAN', () => {
    expect(
      isCompilationRelease(
        { releaseTitle: 'Comp', upcEan: '123', catalogNumber: '' },
        [{ id: 'c1', type: 'ean', identifier: '123', label: 'Comp' }],
      ),
    ).toBe(true)
    expect(
      isCompilationRelease(
        { releaseTitle: 'Comp', upcEan: '999', catalogNumber: '' },
        [{ id: 'c1', type: 'ean', identifier: '123', label: 'Comp' }],
      ),
    ).toBe(false)
  })
})