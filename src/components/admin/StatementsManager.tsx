'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getAdminAccessToken } from '@/lib/admin/getAccessToken'
import type { SalesStatementStatus } from '@/lib/api/salesStatements'
import {
  deriveActiveWorkflowStep,
  deriveCompletedWorkflowSteps,
  emptyWorkflowStatusCounts,
  workflowStatusFromStatement,
  type ArtistStatementWorkflowStatus,
} from '@/lib/sos/statementWorkflow'
import {
  WorkflowStatusBadge,
  WorkflowStepper,
  WorkflowSummaryCard,
} from '@/components/admin/sos/statementWorkflowUi'
import { CircleNotch, PaperPlaneTilt, SealCheck } from '@phosphor-icons/react'
import { useDict } from '@/contexts/DictContext'

type StatementRow = {
  id: string
  artist_id: string
  filename: string
  period: string
  amount_eur: number | null
  status: SalesStatementStatus
  label_notes: string | null
  created_at: string
  artists: { name: string }
}

const STATEMENTS_FALLBACK = {
  historyReadOnlyTitle: 'Read-only history',
  historyReadOnlyBody:
    'Approve statements, record payments, and manage invoices in Settlement Center — not here.',
  historyManageInSettlement: 'Manage in Settlement Center',
  historyDraftPending: '{count} draft(s) awaiting approval in Settlement Center',
} as const

function formatEur(amount: number | null): string {
  if (amount === null) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

interface StatementsManagerProps {
  /** When true (default), hides approve actions — use Settlement Center instead. */
  readOnly?: boolean
  /** Deep link to Settlement Center tab in Accounting. */
  settlementHref?: string
}

export function StatementsManager({
  readOnly = true,
  settlementHref = '/admin/accounting?subTab=settlements',
}: StatementsManagerProps) {
  const dict = useDict()
  const t = { ...STATEMENTS_FALLBACK, ...dict.admin?.accounting }

  const [statements, setStatements] = useState<StatementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const fetchStatements = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = createBrowserSupabaseClient()
    const { data, error: fetchError } = await supabase
      .from('sales_statements')
      .select(`
        id,
        artist_id,
        filename,
        period,
        amount_eur,
        status,
        label_notes,
        created_at,
        artists!inner(name)
      `)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    setStatements((data ?? []) as StatementRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchStatements()
  }, [fetchStatements])

  const filteredStatements = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (!query) return statements
    return statements.filter(
      (statement) =>
        statement.artists.name.toLowerCase().includes(query) ||
        statement.period.toLowerCase().includes(query) ||
        statement.filename.toLowerCase().includes(query),
    )
  }, [statements, filter])

  const counts = useMemo(() => {
    return statements.reduce((acc, statement) => {
      const workflowStatus = workflowStatusFromStatement(statement.status, true)
      acc[workflowStatus] += 1
      return acc
    }, emptyWorkflowStatusCounts())
  }, [statements])

  const workflowProgress = useMemo(
    () => ({
      rowCount: statements.length,
      counts,
    }),
    [statements.length, counts],
  )

  const activeStep = useMemo(
    () => deriveActiveWorkflowStep(workflowProgress),
    [workflowProgress],
  )
  const completedSteps = useMemo(
    () => deriveCompletedWorkflowSteps(workflowProgress),
    [workflowProgress],
  )

  const draftIds = filteredStatements
    .filter((statement) => statement.status === 'draft')
    .map((s) => s.id)
  const selectedDraftIds = Array.from(selectedIds).filter((id) =>
    filteredStatements.some((statement) => statement.id === id && statement.status === 'draft'),
  )
  const handleApprove = async (statementIds: string[]) => {
    if (readOnly || statementIds.length === 0) return
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
        body: JSON.stringify({ ids: statementIds }),
      })

      const json = (await response.json().catch(() => null)) as
        | { approved?: number; emailed?: number; error?: string }
        | null

      if (!response.ok) {
        throw new Error(json?.error ?? 'Freigabe fehlgeschlagen')
      }

      await fetchStatements()
      setSelectedIds(new Set())
      toast.success(
        `${json?.approved ?? 0} Statement${(json?.approved ?? 0) === 1 ? '' : 's'} freigegeben` +
          ((json?.emailed ?? 0) > 0
            ? `, ${json?.emailed} Benachrichtigung${json?.emailed === 1 ? '' : 'en'} versendet`
            : ''),
      )
    } catch (approvalError) {
      toast.error(approvalError instanceof Error ? approvalError.message : 'Freigabe fehlgeschlagen')
    } finally {
      setApproving(false)
    }
  }

  const renderStatementActions = (
    statement: StatementRow,
    workflowStatus: ArtistStatementWorkflowStatus,
  ) => {
    const isDraft = statement.status === 'draft'

    if (readOnly) {
      return (
        <div className="flex flex-wrap justify-end gap-2">
          {isDraft && (
            <Button size="sm" variant="outline" className="gap-1" asChild>
              <Link href={settlementHref}>{t.historyManageInSettlement}</Link>
            </Button>
          )}
          {workflowStatus === 'superseded' && (
            <span className="text-xs text-muted-foreground self-center">Ersetzt</span>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-wrap justify-end gap-2">
        {isDraft && (
          <Button
            disabled={approving}
            onClick={() => void handleApprove([statement.id])}
            size="sm"
            className="gap-1"
          >
            {approving ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneTilt size={14} />}
            Freigeben
          </Button>
        )}
        {workflowStatus === 'superseded' && (
          <span className="text-xs text-muted-foreground self-center">Ersetzt</span>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Statements werden geladen" className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">Statements konnten nicht geladen werden: {error}</p>
  }

  if (statements.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Noch keine Statements hochgeladen.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {readOnly && (
        <Alert className="border-primary/30 bg-primary/5">
          <SealCheck size={16} className="text-primary" />
          <AlertTitle className="text-sm">{t.historyReadOnlyTitle}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span>{t.historyReadOnlyBody}</span>
            <Button size="sm" className="shrink-0" asChild>
              <Link href={settlementHref}>{t.historyManageInSettlement}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Statement-Historie</h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Alle hochgeladenen Statements mit Freigabe-Status.
          {readOnly
            ? ' Freigaben und Zahlungen erfolgen in der Abrechnungszentrale.'
            : ' Für den vollständigen Abrechnungsworkflow nutzen Sie die Abrechnungszentrale im SOS-Generator.'}
        </p>
        {readOnly && counts.draft > 0 && (
          <p className="text-xs text-amber-400">
            {interpolate(t.historyDraftPending, { count: counts.draft })}
          </p>
        )}
      </div>

      <WorkflowStepper activeStep={activeStep} completedSteps={completedSteps} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <WorkflowSummaryCard
          label="Freigabe ausstehend"
          value={counts.draft}
          hint="Entwürfe"
          tone={counts.draft > 0 ? 'warning' : 'muted'}
        />
        <WorkflowSummaryCard label="Benachrichtigt" value={counts.artist_notified} hint="E-Mail versendet" />
        <WorkflowSummaryCard label="Gesehen" value={counts.viewed} hint="Im Portal geöffnet" />
        <WorkflowSummaryCard label="Rechnung" value={counts.invoiced + counts.acknowledged} hint="Rechnung erstellt" />
        <WorkflowSummaryCard label="Bezahlt" value={counts.paid} hint="Abgeschlossen" tone={counts.paid > 0 ? 'success' : 'muted'} />
        <WorkflowSummaryCard label="Ersetzt" value={counts.superseded} hint="Durch Korrektur ersetzt" tone="muted" />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-4 lg:flex-row lg:items-center lg:justify-between">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Nach Künstler, Periode oder Dateiname filtern…"
          className="w-full lg:max-w-md"
        />
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={draftIds.length === 0}
              onClick={() => setSelectedIds(new Set(draftIds))}
            >
              Alle Entwürfe auswählen
            </Button>
            <Button
              className="gap-2"
              disabled={approving || selectedDraftIds.length === 0}
              onClick={() => void handleApprove(selectedDraftIds)}
            >
              {approving ? <CircleNotch size={16} className="animate-spin" /> : <PaperPlaneTilt size={16} />}
              Auswahl freigeben ({selectedDraftIds.length})
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              disabled={approving || counts.draft === 0}
              onClick={() => void handleApprove(draftIds)}
            >
              <SealCheck size={16} />
              Alle Entwürfe ({counts.draft})
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3 md:hidden">
        {filteredStatements.map((statement) => {
          const workflowStatus = workflowStatusFromStatement(statement.status, true)
          const isDraft = statement.status === 'draft'

          return (
            <div
              key={statement.id}
              className="rounded-xl border border-border bg-card/40 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{statement.artists.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{statement.period}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <WorkflowStatusBadge status={workflowStatus} />
                <span className="text-sm tabular-nums">{formatEur(statement.amount_eur)}</span>
                {readOnly && isDraft && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-400">
                    {t.historyManageInSettlement}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate font-mono">{statement.filename}</p>
              <p className="text-xs text-muted-foreground">{formatDate(statement.created_at)}</p>
              {statement.label_notes && (
                <p className="text-xs text-muted-foreground italic">{statement.label_notes}</p>
              )}
              {renderStatementActions(statement, workflowStatus)}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {!readOnly && <TableHead className="w-12" aria-label="Auswahl" />}
              <TableHead>Künstler</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead>Dateiname</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStatements.map((statement) => {
              const workflowStatus = workflowStatusFromStatement(statement.status, true)
              const isDraft = statement.status === 'draft'

              return (
                <TableRow key={statement.id}>
                  {!readOnly && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(statement.id)}
                        onCheckedChange={() => {
                          setSelectedIds((current) => {
                            const next = new Set(current)
                            if (next.has(statement.id)) next.delete(statement.id)
                            else next.add(statement.id)
                            return next
                          })
                        }}
                        aria-label={`${statement.artists.name} auswählen`}
                        disabled={!isDraft}
                      />
                    </TableCell>
                  )}
                  <TableCell>{statement.artists.name}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-sm">{statement.period}</TableCell>
                  <TableCell>
                    <WorkflowStatusBadge status={workflowStatus} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {formatEur(statement.amount_eur)}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{statement.filename}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(statement.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {renderStatementActions(statement, workflowStatus)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}