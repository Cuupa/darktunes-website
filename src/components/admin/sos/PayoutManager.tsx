'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DownloadSimple, Warning, CheckCircle, Bank, CircleNotch } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { LabelArtist, LabelInfo } from '@/lib/sos/types'
import { isValidIBAN } from '@/lib/sos/iban-validator'
import { generateSepaXml, downloadSepaXml } from '@/lib/sos/sepa-generator'
import type { SepaPayoutEntry } from '@/lib/sos/sepa-generator'
import { useDict } from '@/contexts/DictContext'
import { interpolate } from '@/lib/i18n/interpolate'
import { getAdminAccessToken } from '@/lib/admin/getAccessToken'
import { monthToPeriodDate } from '@/lib/sos/lineItemsFromArtistData'
import type { SettlementRegister } from '@/lib/api/settlementRegister'
import { buildPayoutRowsFromRegister } from '@/lib/sos/payoutRowsFromRegister'

interface PayoutManagerProps {
  labelArtists: LabelArtist[]
  labelInfo: LabelInfo
  periodStart: string
  periodEnd: string
  onLabelSepaUpdate?: (sepaIban: string, sepaAccountHolder: string) => void
}

function buildPeriodLabel(periodStart: string, periodEnd: string): string {
  if (periodStart && periodEnd) return `${periodStart} – ${periodEnd}`
  return periodStart || periodEnd || 'Current period'
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function PayoutManager({
  labelArtists,
  labelInfo,
  periodStart,
  periodEnd,
  onLabelSepaUpdate,
}: PayoutManagerProps) {
  const dict = useDict()
  const payoutFallback = {
    payoutValidIbanCount: '{count} artists with valid IBAN',
    payoutInvalidIbanCount: '{count} missing or invalid IBAN',
    payoutSelectedSummary: '{amount} · {count} selected',
    payoutExportSepa: 'Export SEPA XML',
    payoutNoDataTitle: 'No ledger payouts for this period.',
    payoutNoDataHint: 'Approve statements and record payments in Settlement Center first.',
    payoutLedgerSourceHint: 'Amounts come from the settlement ledger, not the CSV session.',
    payoutLoadingRegister: 'Loading settlement ledger…',
    payoutRegisterFailed: 'Could not load settlement ledger',
    payoutColArtist: 'Artist',
    payoutColHolder: 'Account holder',
    payoutColIban: 'IBAN',
    payoutColAmount: 'Payout',
    payoutColStatus: 'Status',
    payoutIbanMissing: 'IBAN missing',
    payoutStatusOk: 'OK',
    payoutStatusInvalid: 'Invalid',
    payoutStatusMissing: 'Missing',
    payoutInvalidIbanTooltip: 'Checksum invalid. SEPA export blocked.',
    payoutSepaFormTitle: 'Label sender account for SEPA XML',
    payoutSepaFormHint:
      'IBAN and account holder are stored locally in this browser (Accounting → SEPA Payout).',
    payoutSepaHolderLabel: 'Account holder',
    payoutSepaIbanLabel: 'IBAN',
    payoutSepaSave: 'Save SEPA details',
    payoutInvalidIbanToast: 'Invalid IBAN',
    payoutHolderMissingToast: 'Account holder is required',
    payoutSepaSavedToast: 'Label SEPA details saved',
    payoutLabelIbanMissingToast: 'Label IBAN missing',
    payoutLabelIbanMissingDesc:
      'Enter the label sender IBAN in the SEPA section below (stored locally in this browser).',
    payoutInvalidLabelIbanToast: 'Invalid label IBAN',
    payoutInvalidLabelIbanDesc: 'The stored label IBAN failed the modulo-97 checksum validation.',
    payoutNoArtistsSelectedToast: 'No artists selected',
    payoutNoArtistsSelectedDesc: 'Select at least one artist with a valid IBAN.',
    payoutSepaExportedToast: 'SEPA XML exported',
    payoutSepaExportedDesc: '{count} transfers · {amount} total',
    payoutSepaExportFailedToast: 'SEPA export failed',
    payoutLabelIbanMissingBadge: 'Label IBAN missing',
  } as const
  const t = useMemo(
    () => ({ ...payoutFallback, ...(dict.admin?.accounting ?? {}) }),
    [dict.admin?.accounting],
  )

  const [register, setRegister] = useState<SettlementRegister | null>(null)
  const [loadingRegister, setLoadingRegister] = useState(true)

  const periodStartDate = monthToPeriodDate(periodStart, false)
  const periodEndDate = monthToPeriodDate(periodEnd || periodStart, true)

  useEffect(() => {
    let cancelled = false

    async function loadRegister() {
      if (!periodStartDate || !periodEndDate) {
        setRegister(null)
        setLoadingRegister(false)
        return
      }

      setLoadingRegister(true)
      try {
        const token = await getAdminAccessToken()
        if (!token) throw new Error('Session expired')

        const params = new URLSearchParams({
          periodStart: periodStartDate,
          periodEnd: periodEndDate,
        })
        const response = await fetch(`/api/admin/settlements/register?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const json = (await response.json().catch(() => null)) as
          | SettlementRegister
          | { error?: string }
          | null

        if (!response.ok) {
          throw new Error(
            (json as { error?: string } | null)?.error ?? payoutFallback.payoutRegisterFailed,
          )
        }

        if (!cancelled) {
          setRegister(json as SettlementRegister)
        }
      } catch (err) {
        if (!cancelled) {
          setRegister(null)
          toast.error(err instanceof Error ? err.message : payoutFallback.payoutRegisterFailed)
        }
      } finally {
        if (!cancelled) setLoadingRegister(false)
      }
    }

    void loadRegister()
    return () => {
      cancelled = true
    }
  }, [periodStartDate, periodEndDate])

  const [draftSepaIban, setDraftSepaIban] = useState(labelInfo.sepaIban ?? '')
  const [draftSepaAccountHolder, setDraftSepaAccountHolder] = useState(
    labelInfo.sepaAccountHolder ?? labelInfo.name ?? '',
  )

  const rows = useMemo(
    () => buildPayoutRowsFromRegister(register?.rows ?? [], labelArtists),
    [register?.rows, labelArtists],
  )

  const validRows = useMemo(() => rows.filter((r) => r.ibanStatus === 'valid'), [rows])
  const invalidRows = useMemo(() => rows.filter((r) => r.ibanStatus !== 'valid'), [rows])

  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const validArtistSet = useMemo(() => new Set(validRows.map((r) => r.artistId)), [validRows])
  const syncedSelected = useMemo(
    () => new Set([...selected].filter((artistId) => validArtistSet.has(artistId))),
    [selected, validArtistSet],
  )

  useEffect(() => {
    setSelected(new Set(validRows.map((r) => r.artistId)))
  }, [validRows])

  const toggleArtist = useCallback((artistId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(artistId)) next.delete(artistId)
      else next.add(artistId)
      return next
    })
  }, [])

  const allValidSelected =
    validRows.length > 0 && validRows.every((r) => syncedSelected.has(r.artistId))

  const toggleSelectAll = useCallback(() => {
    if (allValidSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(validRows.map((r) => r.artistId)))
    }
  }, [allValidSelected, validRows])

  const selectedPayouts = useMemo(
    () => rows.filter((r) => syncedSelected.has(r.artistId)),
    [rows, syncedSelected],
  )
  const totalSelected = useMemo(
    () => selectedPayouts.reduce((acc, r) => acc + r.amount, 0),
    [selectedPayouts],
  )

  const handleExport = useCallback(() => {
    if (!labelInfo.sepaIban) {
      toast.error(t.payoutLabelIbanMissingToast, {
        description: t.payoutLabelIbanMissingDesc,
      })
      return
    }
    if (!isValidIBAN(labelInfo.sepaIban)) {
      toast.error(t.payoutInvalidLabelIbanToast, {
        description: t.payoutInvalidLabelIbanDesc,
      })
      return
    }
    if (selectedPayouts.length === 0) {
      toast.error(t.payoutNoArtistsSelectedToast, {
        description: t.payoutNoArtistsSelectedDesc,
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
      toast.success(t.payoutSepaExportedToast, {
        description: interpolate(t.payoutSepaExportedDesc, {
          count: selectedPayouts.length,
          amount: fmtEur(totalSelected),
        }),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(t.payoutSepaExportFailedToast, { description: message })
    }
  }, [selectedPayouts, labelInfo, periodStart, periodEnd, totalSelected, t])

  const labelIbanOk = useMemo(
    () => !!labelInfo.sepaIban && isValidIBAN(labelInfo.sepaIban),
    [labelInfo.sepaIban],
  )

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-card/60 sticky top-0 z-10">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {loadingRegister ? (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <CircleNotch size={14} className="animate-spin" />
                <span>{t.payoutLoadingRegister}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-muted-foreground">
                    {interpolate(t.payoutValidIbanCount, { count: validRows.length })}
                  </span>
                </div>
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Warning size={14} className="text-red-400" />
                    <span className="text-muted-foreground">
                      {interpolate(t.payoutInvalidIbanCount, { count: invalidRows.length })}
                    </span>
                  </div>
                )}
                {syncedSelected.size > 0 && (
                  <div className="font-medium tabular-nums text-emerald-400">
                    {interpolate(t.payoutSelectedSummary, {
                      amount: fmtEur(totalSelected),
                      count: syncedSelected.size,
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!labelIbanOk && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Warning size={13} weight="bold" />
                {t.payoutLabelIbanMissingBadge}
              </span>
            )}
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={handleExport}
              disabled={loadingRegister || syncedSelected.size === 0}
            >
              <DownloadSimple size={14} />
              {t.payoutExportSepa}
            </Button>
          </div>
        </div>

        {!loadingRegister && rows.length > 0 && (
          <p className="px-6 pt-4 text-xs text-muted-foreground">{t.payoutLedgerSourceHint}</p>
        )}

        {!labelIbanOk && onLabelSepaUpdate && (
          <div className="mx-6 mt-4 p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-3">
            <p className="text-sm font-medium">{t.payoutSepaFormTitle}</p>
            <p className="text-xs text-muted-foreground">{t.payoutSepaFormHint}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="label-sepa-holder">{t.payoutSepaHolderLabel}</Label>
                <Input
                  id="label-sepa-holder"
                  value={draftSepaAccountHolder}
                  onChange={(e) => setDraftSepaAccountHolder(e.target.value)}
                  placeholder="z. B. darkTunes Music Group UG"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="label-sepa-iban">{t.payoutSepaIbanLabel}</Label>
                <Input
                  id="label-sepa-iban"
                  value={draftSepaIban}
                  onChange={(e) => setDraftSepaIban(e.target.value)}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const iban = draftSepaIban.replace(/\s/g, '').toUpperCase()
                if (!isValidIBAN(iban)) {
                  toast.error(t.payoutInvalidIbanToast)
                  return
                }
                if (!draftSepaAccountHolder.trim()) {
                  toast.error(t.payoutHolderMissingToast)
                  return
                }
                onLabelSepaUpdate(iban, draftSepaAccountHolder)
                toast.success(t.payoutSepaSavedToast)
              }}
            >
              {t.payoutSepaSave}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto flex-1">
          {loadingRegister ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <CircleNotch size={32} className="animate-spin opacity-50" />
              <p className="text-sm">{t.payoutLoadingRegister}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <Bank size={32} className="opacity-30" />
              <p className="text-sm">{t.payoutNoDataTitle}</p>
              <p className="text-xs text-muted-foreground/60">{t.payoutNoDataHint}</p>
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
                  <th className="py-3 text-left font-medium text-muted-foreground px-4">
                    {t.payoutColArtist}
                  </th>
                  <th className="py-3 text-left font-medium text-muted-foreground px-4">
                    {t.payoutColHolder}
                  </th>
                  <th className="py-3 text-left font-medium text-muted-foreground px-4">
                    {t.payoutColIban}
                  </th>
                  <th className="py-3 text-right font-medium text-muted-foreground px-4">
                    {t.payoutColAmount}
                  </th>
                  <th className="py-3 text-center font-medium text-muted-foreground px-4">
                    {t.payoutColStatus}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isInvalid = row.ibanStatus !== 'valid'
                  const isChecked = syncedSelected.has(row.artistId)

                  return (
                    <tr
                      key={row.artistId}
                      className={`border-b border-white/5 transition-colors ${
                        isInvalid
                          ? 'bg-red-500/5 hover:bg-red-500/8'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="w-14 px-4 py-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleArtist(row.artistId)}
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
                          <span className="text-red-400 text-xs font-sans font-medium">
                            {t.payoutIbanMissing}
                          </span>
                        ) : row.ibanStatus === 'invalid' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-red-400 underline decoration-dotted cursor-help font-sans">
                                {row.ibanDisplay}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs text-xs bg-red-900/90 text-red-100 border-red-700"
                            >
                              {t.payoutInvalidIbanTooltip}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">{row.ibanDisplay}</span>
                        )}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums font-medium ${
                          isInvalid ? 'text-red-300/70' : 'text-emerald-400'
                        }`}
                      >
                        {fmtEur(row.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.ibanStatus === 'valid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle size={10} />
                            {t.payoutStatusOk}
                          </span>
                        ) : row.ibanStatus === 'invalid' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/25">
                            <Warning size={10} weight="bold" />
                            {t.payoutStatusInvalid}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25">
                            <Warning size={10} weight="bold" />
                            {t.payoutStatusMissing}
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