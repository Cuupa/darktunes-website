import { describe, expect, it } from 'vitest'
import {
  buildSettlementAuditReport,
  type CarryForwardSnapshot,
  type ImportBatchSnapshot,
  type InvoiceSnapshot,
  type LedgerEntrySnapshot,
  type SettlementAuditInput,
  type SettlementPeriodSnapshot,
  type StatementSnapshot,
} from './settlementAuditCore'

function makeInput(overrides: Partial<SettlementAuditInput> = {}): SettlementAuditInput {
  return {
    periods: [],
    statements: [],
    invoices: [],
    ledgerEntries: [],
    carryForwards: [],
    importBatches: [],
    operations: [],
    generatedAt: '2026-09-17T00:00:00.000Z',
    ...overrides,
  }
}

function period(overrides: Partial<SettlementPeriodSnapshot> = {}): SettlementPeriodSnapshot {
  return {
    id: 'period-1',
    label: '2025-10-01 – 2026-03-31',
    periodStart: '2025-10-01',
    periodEnd: '2026-03-31',
    status: 'open',
    ...overrides,
  }
}

function statement(overrides: Partial<StatementSnapshot> = {}): StatementSnapshot {
  return {
    id: 'statement-1',
    artistId: 'artist-1',
    settlementPeriodId: 'period-1',
    periodStart: '2025-10-01',
    periodEnd: '2026-03-31',
    status: 'approved',
    isArchived: false,
    amountEur: 100,
    firstViewedAt: '2025-11-01T00:00:00.000Z',
    createdAt: '2025-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function invoice(overrides: Partial<InvoiceSnapshot> = {}): InvoiceSnapshot {
  return {
    id: 'invoice-1',
    artistId: 'artist-1',
    statementId: null,
    status: 'draft',
    settlementPeriodId: 'period-1',
    servicePeriodStart: '2025-10-01',
    servicePeriodEnd: '2026-03-31',
    pdfUrl: null,
    pdfSha256: null,
    deliveryStatus: 'not_sent',
    deliveryAttemptedAt: null,
    paidAmountCents: null,
    outstandingAmountCents: null,
    updatedAt: '2025-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function ledger(overrides: Partial<LedgerEntrySnapshot> = {}): LedgerEntrySnapshot {
  return {
    id: 'ledger-1',
    artistId: 'artist-1',
    settlementPeriodId: 'period-1',
    entryType: 'statement_payout',
    amountEur: 100,
    referenceType: 'statement',
    referenceId: 'statement-1',
    createdAt: '2025-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function carry(overrides: Partial<CarryForwardSnapshot> = {}): CarryForwardSnapshot {
  return {
    id: 'carry-1',
    fromPeriodId: 'period-0',
    toPeriodId: 'period-1',
    artistId: 'artist-1',
    openingBalanceEur: 20,
    appliedAt: '2025-10-01T00:00:00.000Z',
    createdAt: '2025-10-01T00:00:00.000Z',
    ...overrides,
  }
}

function batch(overrides: Partial<ImportBatchSnapshot> = {}): ImportBatchSnapshot {
  return {
    id: 'batch-1',
    status: 'failed',
    fileHash: null,
    periodStart: '2025-10',
    periodEnd: '2026-03',
    createdAt: '2025-10-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildSettlementAuditReport', () => {
  it('returns no findings for a clean fixture', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        statements: [statement()],
        invoices: [invoice({ statementId: 'statement-1' })],
        ledgerEntries: [ledger()],
      }),
    )

    expect(report.findings).toEqual([])
    expect(report.summary.findings).toBe(0)
    expect(report.generatedAt).toBe('2026-09-17T00:00:00.000Z')
  })

  it('flags a missing period link as uniquely repairable when the bounds match exactly', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        statements: [statement({ settlementPeriodId: null })],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'period_link')
    expect(finding).toBeDefined()
    expect(finding?.repairability).toBe('unique')
    expect(finding?.expectedState).toEqual({ settlement_period_id: 'period-1' })
  })

  it('flags an orphan period link and keeps the case ambiguous without a date match', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        statements: [
          statement({
            settlementPeriodId: 'period-deleted',
            periodStart: '2024-01-01',
            periodEnd: '2024-03-31',
          }),
        ],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'period_link')
    expect(finding?.severity).toBe('error')
    expect(finding?.repairability).toBe('ambiguous')
    expect(finding?.expectedState).toBeNull()
  })

  it('flags a ledger entry without a period link as ambiguous (no dates to match)', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        ledgerEntries: [ledger({ settlementPeriodId: null })],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'period_link')
    expect(finding?.entityType).toBe('artist_settlement_ledger')
    expect(finding?.repairability).toBe('ambiguous')
  })

  it('flags an invoice and statement belonging to different artists', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        statements: [statement({ artistId: 'artist-1' })],
        invoices: [
          invoice({ statementId: 'statement-1', artistId: 'artist-2', status: 'draft' }),
        ],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'artist_mismatch')
    expect(finding?.severity).toBe('error')
    expect(finding?.repairability).toBe('not_repairable')
    expect(finding?.evidence.invoice_artist_id).toBe('artist-2')
  })

  it('flags an invoice in a sent state without a stored PDF', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        invoices: [invoice({ status: 'sent', pdfUrl: null, pdfSha256: null })],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'invoice_without_pdf')
    expect(finding?.severity).toBe('error')
    expect(finding?.evidence.has_pdf_url).toBe(false)
  })

  it('flags stored invoice PDFs without a matching row', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        orphanPdfObjectKeys: ['invoices/artist-1/invoice-deleted.pdf'],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'pdf_without_record')
    expect(finding?.entityType).toBe('r2_object')
    expect(finding?.repairability).toBe('not_repairable')
  })

  it('flags unconfirmed import batches', () => {
    const report = buildSettlementAuditReport(
      makeInput({ importBatches: [batch({ status: 'processing' })] }),
    )

    const finding = report.findings.find((item) => item.category === 'unconfirmed_import_batch')
    expect(finding?.evidence.status).toBe('processing')
    expect(finding?.repairability).toBe('ambiguous')
  })

  it('flags hash and size mismatches of stored artifacts', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        artifactChecks: [
          {
            entityType: 'artist_invoice',
            entityId: 'invoice-1',
            objectKey: 'invoices/artist-1/invoice-1.pdf',
            expectedSha256: 'aaa',
            actualSha256: 'bbb',
            expectedSizeBytes: 1000,
            actualSizeBytes: 999,
          },
        ],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'artifact_integrity')
    expect(finding?.severity).toBe('error')
    expect(finding?.evidence.actual_sha256).toBe('bbb')
    expect(finding?.evidence.actual_size_bytes).toBe(999)
  })

  it('flags duplicated statement payouts and multiple invoices per statement', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        statements: [statement({ amountEur: 100 })],
        invoices: [
          invoice({ id: 'invoice-1', statementId: 'statement-1', status: 'draft' }),
          invoice({ id: 'invoice-2', statementId: 'statement-1', status: 'draft' }),
        ],
        ledgerEntries: [
          ledger({ id: 'ledger-1' }),
          ledger({ id: 'ledger-2' }),
        ],
      }),
    )

    const duplicates = report.findings.filter((item) => item.category === 'duplicate_operation')
    expect(duplicates.length).toBe(2)
    expect(duplicates.some((item) => item.entityType === 'artist_settlement_ledger')).toBe(true)
    expect(duplicates.some((item) => item.entityType === 'artist_invoice')).toBe(true)
  })

  it('flags conflicting operation journal payloads for one resource', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        operations: [
          {
            id: 'op-1',
            operationType: 'invoice_create',
            resourceType: 'artist_invoice',
            resourceId: 'invoice-1',
            status: 'ready',
            payloadHash: 'hash-a',
            createdAt: '2025-11-01T00:00:00.000Z',
          },
          {
            id: 'op-2',
            operationType: 'invoice_create',
            resourceType: 'artist_invoice',
            resourceId: 'invoice-1',
            status: 'ready',
            payloadHash: 'hash-b',
            createdAt: '2025-11-02T00:00:00.000Z',
          },
        ],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'duplicate_operation')
    expect(finding?.entityType).toBe('settlement_operation')
    expect(finding?.evidence.payload_hashes).toBe(2)
  })

  it('flags an applied carry-forward without a carry_in booking as uniquely repairable', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        carryForwards: [carry()],
      }),
    )

    const finding = report.findings.find(
      (item) => item.category === 'carry_forward_integrity',
    )
    expect(finding?.repairability).toBe('unique')
    expect(finding?.expectedState).toMatchObject({
      ledger_entry_type: 'carry_in',
      settlement_period_id: 'period-1',
      amount_eur: 20,
      reference_type: 'settlement_period',
      reference_id: 'period-0',
    })
  })

  it('accepts an applied carry-forward that has exactly one carry_in booking', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        carryForwards: [carry()],
        ledgerEntries: [
          ledger({
            id: 'ledger-carry',
            entryType: 'carry_in',
            amountEur: 20,
            referenceType: 'period_carry_forward',
            referenceId: 'carry-1',
          }),
        ],
      }),
    )

    expect(
      report.findings.filter((item) => item.category === 'carry_forward_integrity'),
    ).toEqual([])
  })

  it('flags multiple carry_in bookings for one applied carry-forward', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        carryForwards: [carry()],
        ledgerEntries: [
          ledger({
            id: 'ledger-carry-1',
            entryType: 'carry_in',
            amountEur: 20,
            referenceType: 'period_carry_forward',
            referenceId: 'carry-1',
          }),
          ledger({
            id: 'ledger-carry-2',
            entryType: 'carry_in',
            amountEur: 20,
            referenceType: 'period_carry_forward',
            referenceId: 'carry-1',
          }),
        ],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'carry_forward_integrity')
    expect(finding?.repairability).toBe('not_repairable')
    expect(finding?.evidence.count).toBe(2)
  })

  it('flags an unapplied carry-forward of an archived period', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period({ status: 'archived' })],
        carryForwards: [carry({ fromPeriodId: 'period-1', appliedAt: null, toPeriodId: null })],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'carry_forward_integrity')
    expect(finding?.severity).toBe('warning')
    expect(finding?.repairability).toBe('ambiguous')
  })

  it('flags a statement payout that differs from the statement amount', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        statements: [statement({ amountEur: 100 })],
        ledgerEntries: [ledger({ amountEur: 90 })],
      }),
    )

    const finding = report.findings.find((item) => item.category === 'balance_mismatch')
    expect(finding?.entityType).toBe('sales_statement')
    expect(finding?.evidence.delta_eur).toBeCloseTo(-10, 5)
  })

  it('flags a paid invoice whose booked payments differ', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        invoices: [invoice({ status: 'paid', paidAmountCents: 10000 })],
        ledgerEntries: [
          ledger({
            id: 'ledger-payment',
            entryType: 'payment',
            amountEur: -90,
            referenceType: 'invoice',
            referenceId: 'invoice-1',
          }),
        ],
      }),
    )

    const finding = report.findings.find(
      (item) => item.category === 'balance_mismatch' && item.entityType === 'artist_invoice',
    )
    expect(finding?.evidence.invoice_paid_eur).toBe(100)
    expect(finding?.evidence.ledger_payment_eur).toBe(-90)
  })

  it('flags missing view and delivery evidence without inventing timestamps', () => {
    const report = buildSettlementAuditReport(
      makeInput({
        periods: [period()],
        statements: [statement({ status: 'viewed', firstViewedAt: null })],
        invoices: [
          invoice({
            status: 'sent',
            pdfUrl: 'invoices/a/i.pdf',
            pdfSha256: 'sha',
            deliveryStatus: 'failed',
          }),
        ],
      }),
    )

    const evidenceFindings = report.findings.filter(
      (item) => item.category === 'missing_evidence',
    )
    expect(evidenceFindings.length).toBe(2)
    expect(evidenceFindings.every((item) => item.repairability === 'not_repairable')).toBe(true)
    expect(evidenceFindings.every((item) => item.expectedState === null)).toBe(true)
  })

  it('orders findings deterministically and counts the summary', () => {
    const input = makeInput({
      periods: [period()],
      statements: [
        statement({ id: 'statement-2', settlementPeriodId: null }),
        statement({ id: 'statement-1', settlementPeriodId: null }),
      ],
      importBatches: [batch()],
    })

    const first = buildSettlementAuditReport(input)
    const second = buildSettlementAuditReport(input)

    expect(first.findings.map((item) => item.id)).toEqual(second.findings.map((item) => item.id))
    expect(first.summary.byCategory.period_link).toBe(2)
    expect(first.summary.byCategory.unconfirmed_import_batch).toBe(1)
    expect(first.summary.bySeverity.warning).toBe(3)
    expect(first.summary.byRepairability.unique).toBe(2)
  })
})
