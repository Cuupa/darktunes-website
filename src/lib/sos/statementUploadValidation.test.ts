import { describe, expect, it } from 'vitest'
import { validateStatementUploadPeriod } from './statementUploadValidation'

describe('validateStatementUploadPeriod', () => {
  it('accepts a resolved month matching the billing period start', () => {
    expect(
      validateStatementUploadPeriod({
        period: '2026-01',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toEqual({
      ok: true,
      period: '2026-01',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
    })
  })

  it('rejects a missing period instead of publishing without one', () => {
    expect(validateStatementUploadPeriod({}).ok).toBe(false)
    expect(
      validateStatementUploadPeriod({ period: '2026-01', periodStart: '', periodEnd: '' }),
    ).toMatchObject({ ok: false, error: 'period_required' })
  })

  it('rejects invalid or reversed ISO dates', () => {
    expect(
      validateStatementUploadPeriod({
        period: '2026-02',
        periodStart: '2026-02-31',
        periodEnd: '2026-03-31',
      }),
    ).toMatchObject({ ok: false, error: 'period_invalid' })

    expect(
      validateStatementUploadPeriod({
        period: '2026-03',
        periodStart: '2026-03-01',
        periodEnd: '2026-01-31',
      }),
    ).toMatchObject({ ok: false, error: 'period_invalid' })
  })

  it('rejects a statement period that does not match the billing period', () => {
    expect(
      validateStatementUploadPeriod({
        period: '2026-02',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toMatchObject({ ok: false, error: 'period_mismatch' })

    // Legacy quarter labels are not accepted for new publications.
    expect(
      validateStatementUploadPeriod({
        period: 'Q1-2026',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toMatchObject({ ok: false, error: 'period_mismatch' })
  })
})
