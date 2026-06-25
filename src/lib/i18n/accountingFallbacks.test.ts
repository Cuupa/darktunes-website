import { describe, expect, it } from 'vitest'
import {
  ACCOUNTING_FALLBACK,
  SETTLEMENT_FALLBACK,
  mergeAccountingLabels,
} from './accountingFallbacks'

describe('accountingFallbacks', () => {
  it('exposes non-empty accounting and settlement fallbacks', () => {
    expect(ACCOUNTING_FALLBACK.pageTitle).toBe('Accounting')
    expect(SETTLEMENT_FALLBACK.settlementHeading).toBe('Settlement Center')
  })

  it('mergeAccountingLabels applies overrides without dropping fallbacks', () => {
    const merged = mergeAccountingLabels({ pageTitle: 'Buchhaltung' })
    expect(merged.pageTitle).toBe('Buchhaltung')
    expect(merged.settlementHeading).toBe('Settlement Center')
    expect(merged.tabGenerate).toBe(ACCOUNTING_FALLBACK.tabGenerate)
  })
})