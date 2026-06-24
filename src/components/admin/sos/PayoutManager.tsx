'use client'

import { useMemo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DownloadSimple, Warning, CheckCircle, Bank } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { ArtistRevenue, LabelArtist, LabelInfo } from '@/lib/sos/types'
import { isValidIBAN, maskIBAN } from '@/lib/sos/iban-validator'
import { generateSepaXml, downloadSepaXml } from '@/lib/sos/sepa-generator'
import type { SepaPayoutEntry } from '@/lib/sos/sepa-generator'

interface PayoutManagerProps {
  revenues: ArtistRevenue[]
  labelArtists: LabelArtist[]
  labelInfo: LabelInfo
  periodStart: string
  periodEnd: string
}

function buildPeriodLabel(periodStart: string, periodEnd: string): string {
  if (periodStart && periodEnd) return `${periodStart} – ${periodEnd}`
  return periodStart || periodEnd || 'Current period'
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

type IbanStatus = 'valid' | 'invalid' | 'missing'

interface PayoutRow {
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

export function PayoutManager({
  revenues,
  labelArtists,
  labelInfo,
  periodStart,
  periodEnd,
}: PayoutManagerProps) {
  const rows = useMemo<PayoutRow[]>(() => {
    return revenues
      .filter(r => r.finalAmount > 0)
      .map(r => {
        const roster = labelArtists.find(a => a.name.toLowerCase() === r.artist.toLowerCase())
        const ibanStatus = deriveIbanStatus(roster)
        const ibanDisplay = roster?.iban ? maskIBAN(roster.iban) : '—'
        return { artistName: r.artist, amount: r.finalAmount, roster, ibanStatus, ibanDisplay }
      })
  }, [revenues, labelArtists])

  const validRows  = useMemo(() => rows.filter(r => r.ibanStatus === 'valid'), [rows])
  const invalidRows = useMemo(() => rows.filter(r => r.ibanStatus !== 'valid'), [rows])

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(validRows.map(r => r.artistName))
  )

  const validArtistSet = useMemo(() => new Set(validRows.map(r => r.artistName)), [validRows])
  const syncedSelected = useMemo(
    () => new Set([...selected].filter(name => validArtistSet.has(name))),
    [selected, validArtistSet]
  )

  const toggleArtist = useCallback((artistName: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(artistName)) next.delete(artistName)
      else next.add(artistName)
      return next
    })
  }, [])

  const allValidSelected = validRows.length > 0 && validRows.every(r => syncedSelected.has(r.artistName))

  const toggleSelectAll = useCallback(() => {
    if (allValidSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(validRows.map(r => r.artistName)))
    }
  }, [allValidSelected, validRows])

  const selectedPayouts = useMemo(
    () => rows.filter(r => syncedSelected.has(r.artistName)),
    [rows, syncedSelected]
  )
  const totalSelected = useMemo(
    () => selectedPayouts.reduce((acc, r) => acc + r.amount, 0),
    [selectedPayouts]
  )

  const handleExport = useCallback(() => {
    if (!labelInfo.sepaIban) {
      toast.error('Label IBAN missing', {
        description: 'Add the label sender IBAN under Settings → Branding → SEPA sender account.',
      })
      return
    }
    if (!isValidIBAN(labelInfo.sepaIban)) {
      toast.error('Invalid label IBAN', {
        description: 'The stored label IBAN failed the modulo-97 checksum validation.',
      })
      return
    }
    if (selectedPayouts.length === 0) {
      toast.error('No artists selected', {
        description: 'Select at least one artist with a valid IBAN.',
      })
      return
    }

    const payoutEntries: SepaPayoutEntry[] = selectedPayouts.map((row, index) => ({
      accountHolder: row.roster?.accountHolder || row.artistName,
      iban: row.roster!.iban!,
      bic: row.roster?.bic,
      amount: row.amount,
      endToEndId: `E2E-${String(index + 1).padStart(4, '0')}`,
    }))

    try {
      const xml = generateSepaXml(payoutEntries, {
        accountHolder: labelInfo.sepaAccountHolder || labelInfo.name,
        iban: labelInfo.sepaIban,
        bic: undefined,
        periodLabel: buildPeriodLabel(periodStart, periodEnd),
      })
      const safeLabel = (labelInfo.name || 'sepa').toLowerCase().replace(/[^a-z0-9]/g, '-')
      const today = new Date().toISOString().slice(0, 10)
      downloadSepaXml(xml, `${safeLabel}-payouts-${today}.xml`)
      toast.success('SEPA XML exported', {
        description: `${selectedPayouts.length} transfers · ${fmtEur(totalSelected)} total`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('SEPA export failed', { description: message })
    }
  }, [selectedPayouts, labelInfo, periodStart, periodEnd, totalSelected])

  const labelIbanOk = useMemo(
    () => !!labelInfo.sepaIban && isValidIBAN(labelInfo.sepaIban),
    [labelInfo.sepaIban]
  )

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-card/60 sticky top-0 z-10">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-muted-foreground">{validRows.length} artists with valid IBAN</span>
            </div>
            {invalidRows.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Warning size={14} className="text-red-400" />
                <span className="text-muted-foreground">{invalidRows.length} missing or invalid IBAN</span>
              </div>
            )}
            {syncedSelected.size > 0 && (
              <div className="font-medium tabular-nums text-emerald-400">
                {fmtEur(totalSelected)} · {syncedSelected.size} selected
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!labelIbanOk && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Warning size={13} weight="bold" />
                Label IBAN missing (Settings → Branding)
              </span>
            )}
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleExport}
              disabled={syncedSelected.size === 0}
            >
              <DownloadSimple size={14} />
              Export SEPA XML
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto flex-1">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <Bank size={32} className="opacity-30" />
              <p className="text-sm">No payouts calculated yet.</p>
              <p className="text-xs text-muted-foreground/60">
                Upload CSV files first, then run the statement calculation.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="w-14 px-4 py-3">
                    <Checkbox
                      checked={allValidSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all artists with valid IBAN"
                      className="border-2 border-white/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                      disabled={validRows.length === 0}
                    />
                  </th>
                  <th className="py-3 text-left font-medium text-muted-foreground px-4">Artist</th>
                  <th className="py-3 text-left font-medium text-muted-foreground px-4">Account holder</th>
                  <th className="py-3 text-left font-medium text-muted-foreground px-4">IBAN</th>
                  <th className="py-3 text-right font-medium text-muted-foreground px-4">Payout</th>
                  <th className="py-3 text-center font-medium text-muted-foreground px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isInvalid = row.ibanStatus !== 'valid'
                  const isChecked = syncedSelected.has(row.artistName)

                  return (
                    <tr
                      key={row.artistName}
                      className={`border-b border-white/5 transition-colors ${
                        isInvalid
                          ? 'bg-red-500/5 hover:bg-red-500/8'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="w-14 px-4 py-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleArtist(row.artistName)}
                          aria-label={`Select ${row.artistName}`}
                          disabled={isInvalid}
                          className="border-2 border-white/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-30"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium">
                        <span className={isInvalid ? 'text-red-300' : ''}>{row.artistName}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {row.roster?.accountHolder || (
                          <span className="text-muted-foreground/40 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {row.ibanStatus === 'missing' ? (
                          <span className="text-red-400 text-xs font-sans font-medium">IBAN missing</span>
                        ) : row.ibanStatus === 'invalid' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-red-400 underline decoration-dotted cursor-help font-sans">
                                {row.ibanDisplay}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs bg-red-900/90 text-red-100 border-red-700">
                              Checksum invalid. SEPA export blocked.
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">{row.ibanDisplay}</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right tabular-nums font-medium ${isInvalid ? 'text-red-300/70' : 'text-emerald-400'}`}>
                        {fmtEur(row.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.ibanStatus === 'valid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle size={10} />OK
                          </span>
                        ) : row.ibanStatus === 'invalid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/25">
                            <Warning size={10} weight="bold" />Invalid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            <Warning size={10} weight="bold" />Missing
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}