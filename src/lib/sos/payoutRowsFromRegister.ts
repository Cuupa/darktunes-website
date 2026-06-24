import type { SettlementRegisterRow } from '@/lib/api/settlementRegister'
import type { LabelArtist } from '@/lib/sos/types'
import { isValidIBAN, maskIBAN } from '@/lib/sos/iban-validator'

export type IbanStatus = 'valid' | 'invalid' | 'missing'

export interface PayoutRowFromRegister {
  artistId: string
  artistName: string
  amount: number
  roster: LabelArtist | undefined
  ibanStatus: IbanStatus
  ibanDisplay: string
}

function deriveIbanStatus(roster: LabelArtist | undefined): IbanStatus {
  if (!roster?.iban) return 'missing'
  return isValidIBAN(roster.iban) ? 'valid' : 'invalid'
}

export function buildPayoutRowsFromRegister(
  registerRows: SettlementRegisterRow[],
  labelArtists: LabelArtist[],
): PayoutRowFromRegister[] {
  const rosterByArtistId = new Map(
    labelArtists
      .filter((artist) => artist.artistId)
      .map((artist) => [artist.artistId!, artist]),
  )
  const rosterByName = new Map(labelArtists.map((artist) => [artist.name.toLowerCase(), artist]))

  return registerRows
    .filter((row) => row.ledgerBalanceEur > 0.005)
    .map((row) => {
      const roster =
        rosterByArtistId.get(row.artistId) ?? rosterByName.get(row.artistName.toLowerCase())
      const ibanStatus = deriveIbanStatus(roster)
      const ibanDisplay = roster?.iban ? maskIBAN(roster.iban) : '—'
      return {
        artistId: row.artistId,
        artistName: row.artistName,
        amount: row.ledgerBalanceEur,
        roster,
        ibanStatus,
        ibanDisplay,
      }
    })
    .sort((a, b) => a.artistName.localeCompare(b.artistName, 'de'))
}