import { describe, expect, it } from 'vitest'
import type { SettlementRegisterRow } from '@/lib/api/settlementRegister'
import type { LabelArtist } from '@/lib/sos/types'
import { buildPayoutRowsFromRegister } from './payoutRowsFromRegister'

function makeRegisterRow(
  overrides: Partial<SettlementRegisterRow> & Pick<SettlementRegisterRow, 'artistId' | 'artistName'>,
): SettlementRegisterRow {
  return {
    statementId: undefined,
    statementStatus: undefined,
    firstViewedAt: undefined,
    statementAmountEur: undefined,
    invoiceId: undefined,
    invoiceStatus: undefined,
    invoiceNumber: undefined,
    receivedAt: undefined,
    paidAt: undefined,
    paidAmountCents: 0,
    outstandingAmountCents: undefined,
    ledgerBalanceEur: 0,
    carryForwardEur: undefined,
    openingBalanceEur: undefined,
    ...overrides,
  }
}

describe('buildPayoutRowsFromRegister', () => {
  const labelArtists: LabelArtist[] = [
    {
      id: '1',
      name: 'Artist One',
      artistId: 'artist-1',
      iban: 'DE89370400440532013000',
      accountHolder: 'Artist One',
    },
  ]

  it('uses ledger balance instead of statement amount', () => {
    const rows = buildPayoutRowsFromRegister(
      [
        makeRegisterRow({
          artistId: 'artist-1',
          artistName: 'Artist One',
          statementAmountEur: 500,
          ledgerBalanceEur: 120.5,
        }),
      ],
      labelArtists,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBe(120.5)
    expect(rows[0].ibanStatus).toBe('valid')
  })

  it('omits artists with zero or negative ledger balance', () => {
    const rows = buildPayoutRowsFromRegister(
      [
        makeRegisterRow({
          artistId: 'artist-1',
          artistName: 'Artist One',
          ledgerBalanceEur: 0,
        }),
        makeRegisterRow({
          artistId: 'artist-2',
          artistName: 'Artist Two',
          ledgerBalanceEur: -10,
        }),
      ],
      labelArtists,
    )

    expect(rows).toEqual([])
  })
})