'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getAdminAccessToken } from '@/lib/admin/getAccessToken'
import type { SettlementRegister, SettlementRegisterRow } from '@/lib/api/settlementRegister'
import type { ArtistRevenue, LabelArtist } from '@/lib/sos/types'
import { monthToPeriodDate } from '@/lib/sos/lineItemsFromArtistData'
import {
  countByWorkflowStatus,
  deriveActiveWorkflowStep,
  deriveCompletedWorkflowSteps,
  workflowStatusFromStatement,
  type ArtistStatementWorkflowStatus,
} from '@/lib/sos/statementWorkflow'
import type { SalesStatementStatus } from '@/lib/api/salesStatements'
import {
  WorkflowProgressIcon,
  WorkflowStatusBadge,
  WorkflowStepper,
  WorkflowSummaryCard,
} from './statementWorkflowUi'
import {
  Archive,
  CircleNotch,
  CurrencyEur,
  FileArrowUp,
  Lock,
  MagnifyingGlass,
  PaperPlaneTilt,
  PencilSimple,
  SealCheck,
  TrayArrowDown,
} from '@phosphor-icons/react'

interface SettlementCenterPanelProps {
  revenues: ArtistRevenue[]
  labelArtists: LabelArtist[]
  periodStart: string
  periodEnd: string
  onCreateDraft: (artist: string) => Promise<void>
}

type MasterRow = {
  artistName: string
  artistId: string | null
  workflowStatus: ArtistStatementWorkflowStatus
  statementId?: string
  firstViewedAt?: string
  invoiceId?: string
  invoiceStatus?: string
  invoiceNumber?: string
  receivedAt?: string
  paidAt?: string
  paidAmountCents: number
  outstandingAmountCents?: number
  ledgerBalanceEur: number
  carryForwardEur?: number
  statementAmountEur?: number
  payout?: number
}

const CORRECTABLE_WORKFLOW_STATUSES: ArtistStatementWorkflowStatus[] = [
  'label_approved',
  'artist_notified',
  'viewed',
  'invoiced',
  'acknowledged',
]

function canCorrectStatement(row: MasterRow): boolean {
  return !!row.statementId && CORRECTABLE_WORKFLOW_STATUSES.includes(row.workflowStatus)
}

type PaymentMethod = 'sepa' | 'paypal' | 'manual' | 'other'

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  sent: 'Gesendet',
  received: 'Eingegangen',
  partially_paid: 'Teilweise bezahlt',
  paid: 'Bezahlt',
  cancelled: 'Storniert',
}

const PERIOD_STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  under_review: 'In Prüfung',
  approved: 'Freigegeben',
  locked: 'Gesperrt',
  archived: 'Archiviert',
}

function fmtEur(value: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtCents(cents: number) {
  return fmtEur(cents / 100)
}

function fmtDate(value: string | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function computeNextPeriod(periodStart: string, periodEnd: string) {
  const start = new Date(`${periodStart}T00:00:00`)
  const end = new Date(`${periodEnd}T00:00:00`)
  const durationMs = end.getTime() - start.getTime()
  const nextStart = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  const nextEnd = new Date(nextStart.getTime() + durationMs)
  return { start: toIsoDate(nextStart), end: toIsoDate(nextEnd) }
}

function registerToMasterRow(row: SettlementRegisterRow): MasterRow {
  return {
    artistName: row.artistName,
    artistId: row.artistId,
    workflowStatus: workflowStatusFromStatement(
      row.statementStatus as SalesStatementStatus | undefined,
      true,
    ),
    statementId: row.statementId,
    firstViewedAt: row.firstViewedAt,
    invoiceId: row.invoiceId,
    invoiceStatus: row.invoiceStatus,
    invoiceNumber: row.invoiceNumber,
    receivedAt: row.receivedAt,
    paidAt: row.paidAt,
    paidAmountCents: row.paidAmountCents,
    outstandingAmountCents: row.outstandingAmountCents,
    ledgerBalanceEur: row.ledgerBalanceEur,
    carryForwardEur: row.carryForwardEur,
    statementAmountEur: row.statementAmountEur,
  }
}

function PeriodStatusBadge({ status }: { status: string }) {
  const className =
    status === 'locked'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
      : status === 'archived'
        ? 'border-muted-foreground/30 bg-muted/40 text-muted-foreground'
        : status === 'open'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : undefined

  return (
    <Badge variant="outline" className={className}>
      {PERIOD_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

function InvoiceStatusBadge({ status }: { status: string | undefined }) {
  if (!status) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const className =
    status === 'paid'
      ? 'bg-emerald-600/90 text-white'
      : status === 'received' || status === 'partially_paid'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
        : status === 'sent'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          : undefined

  return (
    <Badge variant="outline" className={className}>
      {INVOICE_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

function rowIsSelectable(row: MasterRow) {
  return (
    (row.workflowStatus === 'not_uploaded' && !!row.artistId) ||
    (row.workflowStatus === 'draft' && !!row.statementId) ||
    (!!row.invoiceId && !row.receivedAt && row.invoiceStatus === 'sent') ||
    (!!row.invoiceId && row.invoiceStatus !== 'paid' && row.invoiceStatus !== 'cancelled')
  )
}

export function SettlementCenterPanel({
  revenues,
  labelArtists,
  periodStart,
  periodEnd,
  onCreateDraft,
}: SettlementCenterPanelProps) {
  const [register, setRegister] = useState<SettlementRegister | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set())
  const [approvalNotes, setApprovalNotes] = useState('')
  const [creatingDrafts, setCreatingDrafts] = useState(false)
  const [approving, setApproving] = useState(false)
  const [markingReceived, setMarkingReceived] = useState(false)
  const [locking, setLocking] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  const [busyArtists, setBusyArtists] = useState<Set<string>>(new Set())
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [lockDialogOpen, setLockDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [paymentAmountCents, setPaymentAmountCents] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('sepa')
  const [paymentReference, setPaymentReference] = useState('')
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)
  const [correctionTarget, setCorrectionTarget] = useState<MasterRow | null>(null)
  const [correctionAmountEur, setCorrectionAmountEur] = useState('')
  const [correctionNotes, setCorrectionNotes] = useState('')
  const [correcting, setCorrecting] = useState(false)

  const periodStartDate = monthToPeriodDate(periodStart, false)
  const periodEndDate = monthToPeriodDate(periodEnd || periodStart, true)
  const periodLabel =
    periodStart && periodEnd && periodEnd !== periodStart
      ? `${periodStart} – ${periodEnd}`
      : periodStart || periodEnd || 'Aktueller Zeitraum'

  const defaultNextPeriod = useMemo(() => {
    if (!periodStartDate || !periodEndDate) return { start: '', end: '' }
    return computeNextPeriod(periodStartDate, periodEndDate)
  }, [periodStartDate, periodEndDate])

  const [nextPeriodStart, setNextPeriodStart] = useState(defaultNextPeriod.start)
  const [nextPeriodEnd, setNextPeriodEnd] = useState(defaultNextPeriod.end)

  useEffect(() => {
    setNextPeriodStart(defaultNextPeriod.start)
    setNextPeriodEnd(defaultNextPeriod.end)
  }, [defaultNextPeriod.start, defaultNextPeriod.end])

  const artistMap = useMemo(() => {
    const map = new Map<string, LabelArtist>()
    for (const artist of labelArtists) {
      map.set(artist.name.toLowerCase(), artist)
    }
    return map
  }, [labelArtists])

  const refreshRegister = useCallback(async () => {
    if (!periodStartDate || !periodEndDate) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const token = await getAdminAccessToken()
      if (!token) throw new Error('Sitzung abgelaufen')

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
        throw new Error((json as { error?: string } | null)?.error ?? 'Register konnte nicht geladen werden')
      }

      setRegister(json as SettlementRegister)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Register konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [periodStartDate, periodEndDate])

  useEffect(() => {
    void refreshRegister()
  }, [refreshRegister])

  const rows = useMemo<MasterRow[]>(() => {
    const registerRows = register?.rows ?? []
    const registerByArtistId = new Map(registerRows.map((row) => [row.artistId, row]))
    const registerByName = new Map(registerRows.map((row) => [row.artistName.toLowerCase(), row]))
    const seenArtistIds = new Set<string>()
    const seenNames = new Set<string>()
    const masterRows: MasterRow[] = []

    for (const revenue of revenues) {
      const roster = artistMap.get(revenue.artist.toLowerCase())
      const artistId = roster?.artistId?.trim() || null
      const reg =
        (artistId ? registerByArtistId.get(artistId) : undefined) ??
        registerByName.get(revenue.artist.toLowerCase())

      if (reg) {
        masterRows.push({
          ...registerToMasterRow(reg),
          payout: revenue.finalAmount,
        })
        seenArtistIds.add(reg.artistId)
        seenNames.add(revenue.artist.toLowerCase())
      } else {
        masterRows.push({
          artistName: revenue.artist,
          artistId,
          workflowStatus: workflowStatusFromStatement(undefined, !!artistId),
          paidAmountCents: 0,
          ledgerBalanceEur: 0,
          payout: revenue.finalAmount,
        })
        seenNames.add(revenue.artist.toLowerCase())
      }
    }

    for (const reg of registerRows) {
      if (!seenArtistIds.has(reg.artistId) && !seenNames.has(reg.artistName.toLowerCase())) {
        masterRows.push(registerToMasterRow(reg))
      }
    }

    return masterRows.sort((a, b) => a.artistName.localeCompare(b.artistName, 'de'))
  }, [register, revenues, artistMap])

  const filteredRows = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => row.artistName.toLowerCase().includes(query))
  }, [rows, filter])

  const counts = useMemo(() => countByWorkflowStatus(rows), [rows])
  const kpis = useMemo(
    () =>
      register?.kpis ?? {
        approved: 0,
        viewed: 0,
        invoiced: 0,
        received: 0,
        paid: 0,
        openBalanceEur: 0,
      },
    [register?.kpis],
  )
  const period = register?.period
  const periodWritable = period ? !['locked', 'archived'].includes(period.status) : true

  const workflowProgress = useMemo(
    () => ({
      rowCount: rows.length,
      counts,
      kpis,
    }),
    [rows.length, counts, kpis],
  )

  const activeStep = useMemo(
    () => deriveActiveWorkflowStep(workflowProgress),
    [workflowProgress],
  )

  const completedSteps = useMemo(
    () => deriveCompletedWorkflowSteps(workflowProgress),
    [workflowProgress],
  )

  const selectableRows = filteredRows.filter(rowIsSelectable)
  const allSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selectedArtists.has(row.artistName))

  const selectedDraftTargets = rows.filter(
    (row) => selectedArtists.has(row.artistName) && row.workflowStatus === 'not_uploaded' && row.artistId,
  )
  const selectedApproveTargets = rows.filter(
    (row) => selectedArtists.has(row.artistName) && row.workflowStatus === 'draft' && row.statementId,
  )
  const selectedReceivedTargets = rows.filter(
    (row) =>
      selectedArtists.has(row.artistName) &&
      row.invoiceId &&
      !row.receivedAt &&
      row.invoiceStatus === 'sent',
  )
  const selectedPaymentTargets = rows.filter(
    (row) =>
      selectedArtists.has(row.artistName) &&
      row.invoiceId &&
      row.invoiceStatus !== 'paid' &&
      row.invoiceStatus !== 'cancelled',
  )

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedArtists(new Set())
      return
    }
    setSelectedArtists(new Set(selectableRows.map((row) => row.artistName)))
  }

  const toggleArtist = (artistName: string) => {
    setSelectedArtists((current) => {
      const next = new Set(current)
      if (next.has(artistName)) next.delete(artistName)
      else next.add(artistName)
      return next
    })
  }

  const runDraftCreation = async (targets: MasterRow[]) => {
    if (targets.length === 0) return
    setCreatingDrafts(true)
    let created = 0

    for (const target of targets) {
      setBusyArtists((current) => new Set(current).add(target.artistName))
      try {
        await onCreateDraft(target.artistName)
        created += 1
      } finally {
        setBusyArtists((current) => {
          const next = new Set(current)
          next.delete(target.artistName)
          return next
        })
      }
    }

    await refreshRegister()
    setCreatingDrafts(false)
    toast.success(`${created} Entwurf${created === 1 ? '' : 'e'} erstellt`)
  }

  const runApproval = async (statementIds: string[]) => {
    if (statementIds.length === 0) return
    setApproving(true)

    try {
      const token = await getAdminAccessToken()
      if (!token) throw new Error('Sitzung abgelaufen')

      const response = await fetch('/api/admin/sales-statements/bulk-approve', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: statementIds,
          notes: approvalNotes.trim() || undefined,
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | { approved?: number; emailed?: number; error?: string }
        | null

      if (!response.ok) {
        throw new Error(json?.error ?? 'Massenfreigabe fehlgeschlagen')
      }

      await refreshRegister()
      setSelectedArtists(new Set())
      toast.success(
        `${json?.approved ?? 0} Statement${(json?.approved ?? 0) === 1 ? '' : 's'} freigegeben` +
          ((json?.emailed ?? 0) > 0
            ? `, ${json?.emailed} Benachrichtigung${json?.emailed === 1 ? '' : 'en'} versendet`
            : ''),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Freigabe fehlgeschlagen')
    } finally {
      setApproving(false)
    }
  }

  const runMarkReceived = async (targets: MasterRow[]) => {
    if (targets.length === 0) return
    setMarkingReceived(true)

    try {
      const token = await getAdminAccessToken()
      if (!token) throw new Error('Sitzung abgelaufen')

      let updated = 0
      for (const target of targets) {
        const response = await fetch(`/api/admin/invoices/${target.invoiceId}/received`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) {
          throw new Error(json?.error ?? `Rechnung für ${target.artistName} konnte nicht markiert werden`)
        }
        updated += 1
      }

      await refreshRegister()
      setSelectedArtists(new Set())
      toast.success(`${updated} Rechnung${updated === 1 ? '' : 'en'} als eingegangen markiert`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Markierung fehlgeschlagen')
    } finally {
      setMarkingReceived(false)
    }
  }

  const openPaymentDialog = () => {
    if (selectedPaymentTargets.length === 0) return
    const first = selectedPaymentTargets[0]
    const defaultCents =
      first.outstandingAmountCents ??
      (first.payout != null ? Math.round(first.payout * 100) : undefined)
    setPaymentAmountCents(defaultCents != null ? String(defaultCents) : '')
    setPaymentMethod('sepa')
    setPaymentReference('')
    setPaymentDialogOpen(true)
  }

  const runRecordPayment = async () => {
    const amountCents = Number.parseInt(paymentAmountCents, 10)
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      toast.error('Bitte einen gültigen Betrag in Cent eingeben')
      return
    }

    setRecordingPayment(true)
    try {
      const token = await getAdminAccessToken()
      if (!token) throw new Error('Sitzung abgelaufen')

      let recorded = 0
      for (const target of selectedPaymentTargets) {
        const response = await fetch(`/api/admin/invoices/${target.invoiceId}/payment`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amountCents,
            paymentMethod,
            paymentReference: paymentReference.trim() || undefined,
          }),
        })
        const json = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) {
          throw new Error(json?.error ?? `Zahlung für ${target.artistName} fehlgeschlagen`)
        }
        recorded += 1
      }

      await refreshRegister()
      setSelectedArtists(new Set())
      setPaymentDialogOpen(false)
      toast.success(`${recorded} Zahlung${recorded === 1 ? '' : 'en'} erfasst`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Zahlungserfassung fehlgeschlagen')
    } finally {
      setRecordingPayment(false)
    }
  }

  const runLockPeriod = async () => {
    if (!period?.id) return
    setLocking(true)
    try {
      const token = await getAdminAccessToken()
      if (!token) throw new Error('Sitzung abgelaufen')

      const response = await fetch(`/api/admin/settlements/periods/${period.id}/lock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(json?.error ?? 'Periode konnte nicht gesperrt werden')
      }

      await refreshRegister()
      setLockDialogOpen(false)
      toast.success('Abrechnungsperiode gesperrt')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sperren fehlgeschlagen')
    } finally {
      setLocking(false)
    }
  }

  const openCorrectionDialog = (row: MasterRow) => {
    const defaultAmount = row.statementAmountEur ?? row.payout
    setCorrectionTarget(row)
    setCorrectionAmountEur(defaultAmount != null ? String(defaultAmount) : '')
    setCorrectionNotes('')
    setCorrectionDialogOpen(true)
  }

  const correctionDeltaEur = useMemo(() => {
    if (!correctionTarget) return null
    const next = Number.parseFloat(correctionAmountEur.replace(',', '.'))
    if (!Number.isFinite(next)) return null
    const previous = correctionTarget.statementAmountEur ?? correctionTarget.payout
    if (previous == null) return null
    return next - previous
  }, [correctionTarget, correctionAmountEur])

  const runCorrection = async () => {
    if (!correctionTarget?.statementId) return
    const amountEur = Number.parseFloat(correctionAmountEur.replace(',', '.'))
    if (!Number.isFinite(amountEur)) {
      toast.error('Bitte einen gültigen Betrag in EUR eingeben')
      return
    }

    setCorrecting(true)
    try {
      const token = await getAdminAccessToken()
      if (!token) throw new Error('Sitzung abgelaufen')

      const response = await fetch(
        `/api/admin/sales-statements/${correctionTarget.statementId}/correction`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount_eur: amountEur,
            label_notes: correctionNotes.trim() || undefined,
          }),
        },
      )

      const json = (await response.json().catch(() => null)) as
        | { statement?: { id: string }; error?: string }
        | null

      if (!response.ok) {
        throw new Error(json?.error ?? 'Korrektur konnte nicht erstellt werden')
      }

      await refreshRegister()
      setCorrectionDialogOpen(false)
      setCorrectionTarget(null)
      toast.success(
        `Korrektur-Entwurf für ${correctionTarget.artistName} erstellt. Das ursprüngliche Statement wurde ersetzt.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Korrektur fehlgeschlagen')
    } finally {
      setCorrecting(false)
    }
  }

  const renderRowActions = (row: MasterRow, isBusy: boolean) => (
    <div className="flex flex-wrap gap-2">
      {row.workflowStatus === 'not_uploaded' && row.artistId && periodWritable && (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy || creatingDrafts}
          onClick={() => void runDraftCreation([row])}
        >
          {isBusy ? <CircleNotch size={14} className="animate-spin" /> : <FileArrowUp size={14} />}
          Entwurf
        </Button>
      )}
      {row.workflowStatus === 'draft' && row.statementId && periodWritable && (
        <Button size="sm" disabled={approving} onClick={() => void runApproval([row.statementId!])}>
          <PaperPlaneTilt size={14} />
          Freigeben
        </Button>
      )}
      {canCorrectStatement(row) && periodWritable && (
        <Button
          size="sm"
          variant="outline"
          disabled={correcting}
          onClick={() => openCorrectionDialog(row)}
          aria-label={`Korrektur für ${row.artistName}`}
        >
          <PencilSimple size={14} />
          Korrektur
        </Button>
      )}
      {(row.workflowStatus === 'artist_notified' ||
        row.workflowStatus === 'acknowledged' ||
        row.workflowStatus === 'label_approved' ||
        row.workflowStatus === 'viewed' ||
        row.workflowStatus === 'invoiced' ||
        row.workflowStatus === 'paid') && <WorkflowProgressIcon complete />}
    </div>
  )

  const runArchivePeriod = async () => {
    if (!period?.id || !nextPeriodStart || !nextPeriodEnd) return
    setArchiving(true)
    try {
      const token = await getAdminAccessToken()
      if (!token) throw new Error('Sitzung abgelaufen')

      const response = await fetch(`/api/admin/settlements/periods/${period.id}/archive`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nextPeriodStart,
          nextPeriodEnd,
        }),
      })
      const json = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        throw new Error(json?.error ?? 'Periode konnte nicht archiviert werden')
      }

      await refreshRegister()
      setArchiveDialogOpen(false)
      toast.success('Periode archiviert, Überträge in Folgeperiode gebucht')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Archivierung fehlgeschlagen')
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Abrechnungszentrale</h2>
          {period && <PeriodStatusBadge status={period.status} />}
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Gesamtübersicht über Statements, Rechnungen, Zahlungen und offene Salden je Künstler für die
          gewählte Periode.
        </p>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <SealCheck size={16} className="text-primary" />
        <AlertTitle className="text-sm">Periode: {periodLabel}</AlertTitle>
        <AlertDescription className="text-xs">
          Entwürfe benachrichtigen Künstler nicht. Freigabe sendet die Portal-Benachrichtigung und
          ermöglicht Rechnungserstellung.
        </AlertDescription>
      </Alert>

      <WorkflowStepper activeStep={activeStep} completedSteps={completedSteps} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <WorkflowSummaryCard
          label="Freigegeben"
          value={kpis.approved}
          hint="Statements mit Label-Freigabe"
          tone={kpis.approved > 0 ? 'success' : 'muted'}
        />
        <WorkflowSummaryCard
          label="Gesehen"
          value={kpis.viewed}
          hint="Vom Künstler im Portal geöffnet"
          tone={kpis.viewed > 0 ? 'default' : 'muted'}
        />
        <WorkflowSummaryCard
          label="Rechnungen"
          value={kpis.invoiced}
          hint="Rechnungen erstellt"
          tone={kpis.invoiced > 0 ? 'default' : 'muted'}
        />
        <WorkflowSummaryCard
          label="Eingegangen"
          value={kpis.received}
          hint="Rechnungen beim Label eingegangen"
          tone={kpis.received > 0 ? 'default' : 'muted'}
        />
        <WorkflowSummaryCard
          label="Bezahlt"
          value={kpis.paid}
          hint="Zahlungen vollständig erfasst"
          tone={kpis.paid > 0 ? 'success' : 'muted'}
        />
        <div
          className={`rounded-lg border p-4 ${
            kpis.openBalanceEur > 0
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border bg-card/30'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Offener Saldo</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtEur(kpis.openBalanceEur)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Summe aller offenen Ledger-Salden</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 flex-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Interne Freigabe-Notizen (optional)
            </label>
            <Textarea
              value={approvalNotes}
              onChange={(event) => setApprovalNotes(event.target.value)}
              placeholder="Notizen für die ausgewählten Freigaben…"
              className="min-h-[72px] resize-y"
              disabled={!periodWritable}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
            <Button
              size="default"
              variant="secondary"
              className="gap-2 w-full sm:w-auto"
              disabled={!periodWritable || creatingDrafts || selectedDraftTargets.length === 0}
              onClick={() => void runDraftCreation(selectedDraftTargets)}
            >
              {creatingDrafts ? <CircleNotch size={18} className="animate-spin" /> : <FileArrowUp size={18} />}
              Entwürfe erstellen ({selectedDraftTargets.length})
            </Button>
            <Button
              size="default"
              className="gap-2 w-full sm:w-auto"
              disabled={!periodWritable || approving || selectedApproveTargets.length === 0}
              onClick={() => void runApproval(selectedApproveTargets.map((row) => row.statementId!))}
            >
              {approving ? <CircleNotch size={18} className="animate-spin" /> : <PaperPlaneTilt size={18} />}
              Freigeben &amp; benachrichtigen ({selectedApproveTargets.length})
            </Button>
            <Button
              size="default"
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              disabled={!periodWritable || markingReceived || selectedReceivedTargets.length === 0}
              onClick={() => void runMarkReceived(selectedReceivedTargets)}
            >
              {markingReceived ? (
                <CircleNotch size={18} className="animate-spin" />
              ) : (
                <TrayArrowDown size={18} />
              )}
              Als eingegangen ({selectedReceivedTargets.length})
            </Button>
            <Button
              size="default"
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              disabled={!periodWritable || selectedPaymentTargets.length === 0}
              onClick={openPaymentDialog}
            >
              <CurrencyEur size={18} />
              Zahlung erfassen ({selectedPaymentTargets.length})
            </Button>
            <Button
              size="default"
              variant="outline"
              className="gap-2 w-full sm:w-auto"
              disabled={!periodWritable || locking || !period || period.status === 'locked' || period.status === 'archived'}
              onClick={() => setLockDialogOpen(true)}
            >
              {locking ? <CircleNotch size={18} className="animate-spin" /> : <Lock size={18} />}
              Periode sperren
            </Button>
            <Button
              size="default"
              variant="outline"
              className="gap-2 w-full sm:w-auto col-span-2 sm:col-span-1"
              disabled={!periodWritable || archiving || !period || period.status === 'archived'}
              onClick={() => setArchiveDialogOpen(true)}
            >
              {archiving ? <CircleNotch size={18} className="animate-spin" /> : <Archive size={18} />}
              Periode archivieren
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Künstler filtern…"
              className="pl-8 h-9"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={toggleSelectAll} disabled={selectableRows.length === 0}>
            {allSelected ? 'Auswahl aufheben' : 'Aktionszeilen auswählen'}
          </Button>
        </div>

        <div className="space-y-3 border-b border-border p-4 lg:hidden">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Abrechnungsregister wird geladen…</p>
          ) : filteredRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Keine Künstler für den aktuellen Filter.</p>
          ) : (
            filteredRows.map((row) => {
              const actionable = rowIsSelectable(row)
              const isBusy = busyArtists.has(row.artistName)
              return (
                <div key={row.artistName} className="rounded-lg border border-border bg-card/30 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{row.artistName}</p>
                      <WorkflowStatusBadge status={row.workflowStatus} />
                    </div>
                    {actionable && (
                      <Checkbox
                        checked={selectedArtists.has(row.artistName)}
                        onCheckedChange={() => toggleArtist(row.artistName)}
                        aria-label={`${row.artistName} auswählen`}
                      />
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Gesehen</dt>
                      <dd>{fmtDate(row.firstViewedAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Rechnung</dt>
                      <dd>
                        <InvoiceStatusBadge status={row.invoiceStatus} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Offener Saldo</dt>
                      <dd className="tabular-nums">{fmtEur(row.ledgerBalanceEur)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Übertrag</dt>
                      <dd className="tabular-nums">
                        {row.carryForwardEur != null ? fmtEur(row.carryForwardEur) : '—'}
                      </dd>
                    </div>
                  </dl>
                  {renderRowActions(row, isBusy)}
                </div>
              )
            })
          )}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Aktionszeilen auswählen"
                    disabled={selectableRows.length === 0}
                  />
                </TableHead>
                <TableHead>Künstler</TableHead>
                <TableHead>Statement</TableHead>
                <TableHead>Gesehen</TableHead>
                <TableHead>Rechnung</TableHead>
                <TableHead>Eingegangen</TableHead>
                <TableHead>Bezahlt</TableHead>
                <TableHead className="text-right">Offener Saldo</TableHead>
                <TableHead className="text-right">Übertrag</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                    Abrechnungsregister wird geladen…
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                    Keine Künstler für den aktuellen Filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
                  const actionable = rowIsSelectable(row)
                  const isBusy = busyArtists.has(row.artistName)

                  return (
                    <TableRow key={row.artistName}>
                      <TableCell>
                        <Checkbox
                          checked={selectedArtists.has(row.artistName)}
                          onCheckedChange={() => toggleArtist(row.artistName)}
                          aria-label={`${row.artistName} auswählen`}
                          disabled={!actionable}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{row.artistName}</TableCell>
                      <TableCell>
                        <WorkflowStatusBadge status={row.workflowStatus} />
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(row.firstViewedAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <InvoiceStatusBadge status={row.invoiceStatus} />
                          {row.invoiceNumber && (
                            <span className="text-[10px] text-muted-foreground">{row.invoiceNumber}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(row.receivedAt)}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span>{fmtDate(row.paidAt)}</span>
                          {row.paidAmountCents > 0 && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {fmtCents(row.paidAmountCents)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span
                          className={
                            row.ledgerBalanceEur > 0
                              ? 'text-amber-300'
                              : row.ledgerBalanceEur < 0
                                ? 'text-sky-300'
                                : undefined
                          }
                        >
                          {fmtEur(row.ledgerBalanceEur)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.carryForwardEur != null ? fmtEur(row.carryForwardEur) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{renderRowActions(row, isBusy)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={correctionDialogOpen}
        onOpenChange={(open) => {
          setCorrectionDialogOpen(open)
          if (!open) setCorrectionTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Statement-Korrektur</DialogTitle>
            <DialogDescription>
              Erstellt einen neuen Korrektur-Entwurf und markiert das bisherige Statement als ersetzt.
              Anschließend muss der Korrektur-Entwurf erneut freigegeben werden.
            </DialogDescription>
          </DialogHeader>
          {correctionTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{correctionTarget.artistName}</p>
                <p className="mt-1 text-muted-foreground">
                  Bisheriger Betrag:{' '}
                  <span className="tabular-nums text-foreground">
                    {correctionTarget.statementAmountEur != null
                      ? fmtEur(correctionTarget.statementAmountEur)
                      : correctionTarget.payout != null
                        ? fmtEur(correctionTarget.payout)
                        : '—'}
                  </span>
                </p>
                {correctionDeltaEur != null && (
                  <p className="mt-1 text-muted-foreground">
                    Änderung:{' '}
                    <span
                      className={`tabular-nums ${
                        correctionDeltaEur > 0
                          ? 'text-emerald-300'
                          : correctionDeltaEur < 0
                            ? 'text-amber-300'
                            : 'text-foreground'
                      }`}
                    >
                      {correctionDeltaEur >= 0 ? '+' : ''}
                      {fmtEur(correctionDeltaEur)}
                    </span>
                  </p>
                )}
              </div>
              {correctionTarget.invoiceId && (
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <AlertDescription className="text-xs">
                    Für diesen Künstler existiert bereits eine Rechnung. Prüfen Sie Auswirkungen auf
                    Zahlung und Ledger manuell nach der Korrektur.
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="correction-amount">Korrigierter Betrag (EUR)</Label>
                <Input
                  id="correction-amount"
                  type="text"
                  inputMode="decimal"
                  value={correctionAmountEur}
                  onChange={(event) => setCorrectionAmountEur(event.target.value)}
                  placeholder="z. B. 1234,56"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correction-notes">Interne Notiz (optional)</Label>
                <Textarea
                  id="correction-notes"
                  value={correctionNotes}
                  onChange={(event) => setCorrectionNotes(event.target.value)}
                  placeholder="Grund der Korrektur…"
                  className="min-h-[72px] resize-y"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button disabled={correcting || !correctionTarget} onClick={() => void runCorrection()}>
              {correcting ? <CircleNotch size={16} className="animate-spin" /> : null}
              Korrektur-Entwurf erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zahlung erfassen</DialogTitle>
            <DialogDescription>
              Erfasst dieselbe Zahlung für {selectedPaymentTargets.length} ausgewählte Rechnung
              {selectedPaymentTargets.length === 1 ? '' : 'en'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Betrag (Cent)</Label>
              <Input
                id="payment-amount"
                type="number"
                min={1}
                value={paymentAmountCents}
                onChange={(event) => setPaymentAmountCents(event.target.value)}
                placeholder="z. B. 12500"
              />
            </div>
            <div className="space-y-2">
              <Label>Zahlungsmethode</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sepa">SEPA</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="manual">Manuell</SelectItem>
                  <SelectItem value="other">Sonstige</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-reference">Referenz (optional)</Label>
              <Input
                id="payment-reference"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                placeholder="Verwendungszweck / Transaktions-ID"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button disabled={recordingPayment} onClick={() => void runRecordPayment()}>
              {recordingPayment ? <CircleNotch size={16} className="animate-spin" /> : null}
              Zahlung speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Periode sperren?</AlertDialogTitle>
            <AlertDialogDescription>
              Gesperrte Perioden können nicht mehr bearbeitet werden. Statements und Rechnungen bleiben
              einsehbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={locking} onClick={() => void runLockPeriod()}>
              {locking ? 'Wird gesperrt…' : 'Periode sperren'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Periode archivieren?</AlertDialogTitle>
            <AlertDialogDescription>
              Offene Salden werden als Übertrag in die Folgeperiode gebucht. Diese Aktion kann nicht
              rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="next-period-start">Folgeperiode Start (YYYY-MM-DD)</Label>
              <Input
                id="next-period-start"
                value={nextPeriodStart}
                onChange={(event) => setNextPeriodStart(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next-period-end">Folgeperiode Ende (YYYY-MM-DD)</Label>
              <Input
                id="next-period-end"
                value={nextPeriodEnd}
                onChange={(event) => setNextPeriodEnd(event.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={archiving} onClick={() => void runArchivePeriod()}>
              {archiving ? 'Wird archiviert…' : 'Archivieren & Überträge buchen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}