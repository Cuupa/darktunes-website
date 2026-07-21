import { describe, expect, it } from 'vitest'
import {
  computeCarryForwardOpeningBalance,
  invoiceGrossCents,
  invoiceTotalCents,
  sumLedgerBalance,
  type CarryForwardBreakdown,
} from './settlementLedger'
import type { LedgerEntry } from './settlementLedger'

describe('settlementLedger helpers', () => {
  it('sums ledger entry amounts', () => {
    const entries: LedgerEntry[] = [
      {
        id: '1',
        artistId: 'a',
        settlementPeriodId: 'p',
        entryType: 'statement_payout',
        amountEur: 100,
        currency: undefined,
        amountOriginal: undefined,
        fxRate: undefined,
        referenceType: undefined,
        referenceId: undefined,
        description: undefined,
        createdBy: undefined,
        createdAt: '2026-01-01',
      },
      {
        id: '2',
        artistId: 'a',
        settlementPeriodId: 'p',
        entryType: 'payment',
        amountEur: -40,
        currency: undefined,
        amountOriginal: undefined,
        fxRate: undefined,
        referenceType: undefined,
        referenceId: undefined,
        description: undefined,
        createdBy: undefined,
        createdAt: '2026-01-02',
      },
    ]

    expect(sumLedgerBalance(entries)).toBe(60)
  })

  it('computes carry-forward opening balance from breakdown', () => {
    const breakdown: CarryForwardBreakdown = {
      statementBalanceEur: 50,
      unpaidInvoiceCents: 2500,
      partialPaymentRemainderCents: 1000,
    }

    expect(computeCarryForwardOpeningBalance(breakdown)).toBe(85)
  })

  it('totals invoice line items in cents', () => {
    expect(
      invoiceTotalCents([
        { qty: 1, unit_price_cents: 12500 },
        { qty: 2, unit_price_cents: 500 },
      ]),
    ).toBe(13500)
  })

  it('computes gross invoice total with VAT', () => {
    expect(invoiceGrossCents([{ qty: 1, unit_price_cents: 10000 }], 19)).toBe(11900)
    expect(invoiceGrossCents([{ qty: 1, unit_price_cents: 10000 }], 0)).toBe(10000)
  })
})