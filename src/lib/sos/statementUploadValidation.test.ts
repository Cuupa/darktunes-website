import { describe, expect, it } from 'vitest'
import {
  validateStatementSourceArchive,
  validateStatementUploadPeriod,
} from './statementUploadValidation'

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

describe('validateStatementSourceArchive', () => {
  const completedBatch = {
    id: 'batch-1',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    status: 'completed',
    fileHash: 'ab'.repeat(32),
  }

  it('allows the explicit PDF-only path when no source batches are saved', () => {
    expect(
      validateStatementSourceArchive({
        sourceMode: 'manual',
        sourceBatchIds: [],
        workspaceBatchIds: [],
        batches: [],
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toEqual({ ok: true })
  })

  it('rejects a missing server-side archive manifest', () => {
    expect(
      validateStatementSourceArchive({
        sourceMode: 'bronze',
        sourceBatchIds: ['batch-1'],
        workspaceBatchIds: [],
        batches: [completedBatch],
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toMatchObject({ ok: false, error: 'source_archive_incomplete' })
  })

  it('rejects omitted or changed bronze source IDs against the persisted workspace', () => {
    expect(
      validateStatementSourceArchive({
        sourceMode: 'bronze',
        sourceBatchIds: ['batch-1', 'batch-2'],
        workspaceBatchIds: ['batch-1'],
        batches: [completedBatch],
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
      ).toMatchObject({ ok: false, error: 'source_manifest_mismatch' })

    expect(
      validateStatementSourceArchive({
        sourceMode: 'bronze',
        sourceBatchIds: ['batch-2'],
        workspaceBatchIds: ['batch-1'],
        batches: [completedBatch],
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
      ).toMatchObject({ ok: false, error: 'source_manifest_mismatch' })

    expect(
      validateStatementSourceArchive({
        sourceMode: 'manual',
        sourceBatchIds: [],
        workspaceBatchIds: ['batch-1'],
        batches: [completedBatch],
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toEqual({ ok: true })
  })

  it('accepts only completed, hashed batches from the exact period', () => {
    expect(
      validateStatementSourceArchive({
        sourceMode: 'bronze',
        sourceBatchIds: ['batch-1'],
        workspaceBatchIds: ['batch-1'],
        batches: [completedBatch],
        primaryBatchId: 'batch-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toEqual({ ok: true })

    expect(
      validateStatementSourceArchive({
        sourceMode: 'bronze',
        sourceBatchIds: ['batch-1'],
        workspaceBatchIds: ['batch-1'],
        batches: [{ ...completedBatch, status: 'uploaded' }],
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toMatchObject({ ok: false, error: 'source_batch_invalid' })

    expect(
      validateStatementSourceArchive({
        sourceMode: 'bronze',
        sourceBatchIds: ['batch-1'],
        workspaceBatchIds: ['batch-1'],
        batches: [{ ...completedBatch, periodStart: '2025-10', periodEnd: '2025-12' }],
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      }),
    ).toMatchObject({ ok: false, error: 'source_batch_invalid' })
  })
})
