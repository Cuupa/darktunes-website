'use client'

/**
 * Read-only settlement data audit panel (§E.3).
 *
 * Renders every contract view state: loading, empty, read error, partial
 * (truncated), read-only (locked/archived scope), no access, stale report and
 * the populated table with stable finding ids.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowsClockwise, CaretDown, CaretUp, Lock, Warning } from '@phosphor-icons/react'
import { AdminListShell } from '@/components/admin/AdminListShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { getAdminAccessToken } from '@/lib/admin/getAccessToken'
import { cn } from '@/lib/utils'
import { AUDIT_CATEGORIES } from '@/lib/api/settlementAuditCore'
import {
  SettlementAuditApiError,
  fetchSettlementAudit,
  fetchSettlementPeriodsForAudit,
  type SettlementAuditFindingApi,
  type SettlementAuditPeriodApi,
  type SettlementAuditResponseApi,
} from '@/lib/api/settlementAuditApi'

const PAGE_SIZE = 100

const CATEGORY_LABELS = {
  period_link: 'categories.period_link',
  artist_mismatch: 'categories.artist_mismatch',
  invoice_without_pdf: 'categories.invoice_without_pdf',
  pdf_without_record: 'categories.pdf_without_record',
  unconfirmed_import_batch: 'categories.unconfirmed_import_batch',
  artifact_integrity: 'categories.artifact_integrity',
  duplicate_operation: 'categories.duplicate_operation',
  carry_forward_integrity: 'categories.carry_forward_integrity',
  balance_mismatch: 'categories.balance_mismatch',
  missing_evidence: 'categories.missing_evidence',
} as const

const SEVERITY_LABELS = {
  error: 'severity.error',
  warning: 'severity.warning',
  info: 'severity.info',
} as const

const REPAIRABILITY_LABELS = {
  unique: 'repairability.unique',
  ambiguous: 'repairability.ambiguous',
  not_repairable: 'repairability.not_repairable',
} as const

function severityVariant(severity: SettlementAuditFindingApi['severity']) {
  if (severity === 'error') return 'destructive' as const
  if (severity === 'warning') return 'secondary' as const
  return 'outline' as const
}

function repairabilityVariant(repairability: SettlementAuditFindingApi['repairability']) {
  if (repairability === 'unique') return 'default' as const
  if (repairability === 'ambiguous') return 'secondary' as const
  return 'outline' as const
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function SettlementDataAuditPanel() {
  const t = useTranslations('admin.accounting.dataAudit')

  const [periods, setPeriods] = useState<SettlementAuditPeriodApi[]>([])
  const [periodsError, setPeriodsError] = useState(false)
  const [periodId, setPeriodId] = useState('all')
  const [category, setCategory] = useState('all')
  const [report, setReport] = useState<SettlementAuditResponseApi | null>(null)
  const [findings, setFindings] = useState<SettlementAuditFindingApi[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAdminAccessToken()
      if (!token) {
        setError({ status: 401, message: t('accessDenied') })
        return
      }
      const response = await fetchSettlementAudit(
        token,
        {
          periodId: periodId === 'all' ? undefined : periodId,
          categories: category === 'all' ? undefined : [category],
          limit: PAGE_SIZE,
        },
        t('loadError'),
      )
      setReport(response)
      setFindings(response.findings)
      setNextCursor(response.next_cursor)
      setExpandedId(null)
    } catch (err) {
      setError({
        status: err instanceof SettlementAuditApiError ? err.status : 500,
        message: err instanceof Error ? err.message : t('loadError'),
      })
    } finally {
      setLoading(false)
    }
  }, [periodId, category, t])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const token = await getAdminAccessToken()
      if (!token) {
        setError({ status: 401, message: t('accessDenied') })
        return
      }
      const response = await fetchSettlementAudit(
        token,
        {
          periodId: periodId === 'all' ? undefined : periodId,
          categories: category === 'all' ? undefined : [category],
          limit: PAGE_SIZE,
          cursor: nextCursor,
        },
        t('loadError'),
      )
      setFindings((previous) => [...previous, ...response.findings])
      setNextCursor(response.next_cursor)
      setReport(response)
    } catch (err) {
      setError({
        status: err instanceof SettlementAuditApiError ? err.status : 500,
        message: err instanceof Error ? err.message : t('loadError'),
      })
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, loadingMore, periodId, category, t])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const token = await getAdminAccessToken()
        if (!token) return
        const list = await fetchSettlementPeriodsForAudit(token, t('loadError'))
        if (!cancelled) {
          setPeriods(list)
          setPeriodsError(false)
        }
      } catch {
        if (!cancelled) setPeriodsError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === periodId) ?? null,
    [periods, periodId],
  )

  const isAccessError = error?.status === 401 || error?.status === 403

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={periodId} onValueChange={setPeriodId}>
        <SelectTrigger className="h-11 w-[220px]" aria-label={t('filterPeriod')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allPeriods')}</SelectItem>
          {periods.map((period) => (
            <SelectItem key={period.id} value={period.id}>
              {period.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="h-11 w-[220px]" aria-label={t('filterCategory')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allCategories')}</SelectItem>
          {AUDIT_CATEGORIES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(CATEGORY_LABELS[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2"
        onClick={() => void loadInitial()}
        disabled={loading}
      >
        <ArrowsClockwise className={cn('h-4 w-4', loading && 'animate-spin')} />
        {t('refresh')}
      </Button>

      {report && (
        <span className="text-xs text-muted-foreground">
          {t('generatedAt', { value: new Date(report.generated_at).toLocaleString() })}
        </span>
      )}
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        {report ? t('findingsCount', { count: report.summary.findings }) : null}
      </span>
      {nextCursor ? (
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? t('loadingMore') : t('loadMore')}
        </Button>
      ) : null}
    </div>
  )

  return (
    <AdminListShell header={header} footer={footer}>
      <div className="space-y-3 p-4">
        {selectedPeriod && (selectedPeriod.status === 'locked' || selectedPeriod.status === 'archived') && (
          <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            {t('readOnlyHint')}
          </p>
        )}

        {periodsError && (
          <p className="text-xs text-muted-foreground">{t('periodsLoadError')}</p>
        )}

        {report?.truncated && (
          <p className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Warning className="h-4 w-4 shrink-0" />
            {t('truncated')}
          </p>
        )}

        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label={t('loading')}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : isAccessError ? (
          <div className="rounded-md border border-border p-6 text-sm" role="alert">
            {t('accessDenied')}
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-md border border-destructive/40 p-6 text-sm" role="alert">
            <p className="font-medium">{t('loadError')}</p>
            <p className="text-muted-foreground">{error.message}</p>
            <Button type="button" variant="outline" className="h-11" onClick={() => void loadInitial()}>
              {t('retry')}
            </Button>
          </div>
        ) : findings.length === 0 ? (
          <div className="rounded-md border border-border p-8 text-center text-sm">
            <p className="font-medium">{t('emptyTitle')}</p>
            <p className="mt-1 text-muted-foreground">{t('emptyBody')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">{t('columnCategory')}</TableHead>
                <TableHead className="w-[110px]">{t('columnSeverity')}</TableHead>
                <TableHead>{t('columnSummary')}</TableHead>
                <TableHead className="w-[130px]">{t('columnRepairability')}</TableHead>
                <TableHead className="w-[64px]">{t('columnAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((finding) => {
                const expanded = expandedId === finding.id
                return (
                  <TableRow key={finding.id} id={finding.id}>
                    <TableCell className="align-top text-sm">
                      {t(CATEGORY_LABELS[finding.category])}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={severityVariant(finding.severity)}>
                        {t(SEVERITY_LABELS[finding.severity])}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top text-sm">
                      <p>{finding.summary}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {finding.entity_type} · {finding.entity_id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{finding.suggested_action}</p>
                      {expanded && (
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                          <div>
                            <p className="font-medium">{t('evidence')}</p>
                            <dl className="mt-1 space-y-1">
                              {Object.entries(finding.evidence).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <dt className="text-muted-foreground">{key}</dt>
                                  <dd className="break-all">{formatValue(value)}</dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                          {finding.expected_state && (
                            <div>
                              <p className="font-medium">{t('expectedState')}</p>
                              <dl className="mt-1 space-y-1">
                                {Object.entries(finding.expected_state).map(([key, value]) => (
                                  <div key={key} className="flex gap-2">
                                    <dt className="text-muted-foreground">{key}</dt>
                                    <dd className="break-all">{formatValue(value)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={repairabilityVariant(finding.repairability)}>
                        {t(REPAIRABILITY_LABELS[finding.repairability])}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-11 w-11 p-0"
                        aria-expanded={expanded}
                        aria-label={expanded ? t('hideDetails') : t('details')}
                        onClick={() => setExpandedId(expanded ? null : finding.id)}
                      >
                        {expanded ? <CaretUp className="h-4 w-4" /> : <CaretDown className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminListShell>
  )
}
