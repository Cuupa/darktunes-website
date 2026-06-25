'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { SosAnalyticsPersistPanel } from '@/components/admin/sos/SosAnalyticsPersistPanel'
import { fmtEur } from '@/components/admin/sos/settlementCenterModel'
import {
  WorkflowStepper,
  WorkflowSummaryCard,
} from '@/components/admin/sos/statementWorkflowUi'
import type { SettlementCenterState } from '@/hooks/useSettlementCenter'
import { SealCheck, WarningCircle } from '@phosphor-icons/react'
import { interpolate } from '@/lib/i18n/interpolate'

function PeriodStatusBadge({
  status,
  labels,
}: {
  status: string
  labels: Record<string, string>
}) {
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
      {labels[status] ?? status}
    </Badge>
  )
}

interface SettlementWorkflowOverviewProps {
  settlement: SettlementCenterState
  persistDisabled: boolean
}

export function SettlementWorkflowOverview({
  settlement,
  persistDisabled,
}: SettlementWorkflowOverviewProps) {
  const {
    t,
    periodLabel,
    period,
    periodStatusLabels,
    periodStart,
    periodEnd,
    territoryMetrics,
    merchOrderRows,
    labelArtists,
    revenues,
    bronzeBatchIds,
    activeStep,
    completedSteps,
    kpis,
    balanceReconciliation,
  } = settlement

  const showReconciliationWarning =
    balanceReconciliation != null && !balanceReconciliation.ok

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{t.settlementHeading}</h2>
          {period && <PeriodStatusBadge status={period.status} labels={periodStatusLabels} />}
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          {t.settlementDescription}
        </p>
      </div>

      <Alert className="border-primary/30 bg-primary/5">
        <SealCheck size={16} className="text-primary" />
        <AlertTitle className="text-sm">
          {interpolate(t.settlementPeriodAlertTitle, { period: periodLabel })}
        </AlertTitle>
        <AlertDescription className="text-xs">{t.settlementPeriodAlertBody}</AlertDescription>
      </Alert>

      {showReconciliationWarning && balanceReconciliation && (
        <Alert className="border-amber-500/40 bg-amber-500/10" role="status">
          <WarningCircle size={16} className="text-amber-300" aria-hidden="true" />
          <AlertTitle className="text-sm text-amber-100">
            {t.settlementReconciliationTitle}
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-100/90">
            {interpolate(t.settlementReconciliationBody, {
              computed: balanceReconciliation.computedOpenBalanceEur.toFixed(2),
              reported: balanceReconciliation.reportedOpenBalanceEur.toFixed(2),
              delta: balanceReconciliation.deltaEur.toFixed(2),
            })}
          </AlertDescription>
        </Alert>
      )}

      <SosAnalyticsPersistPanel
        periodStart={periodStart}
        periodEnd={periodEnd}
        territoryMetrics={territoryMetrics}
        merchOrderRows={merchOrderRows}
        labelArtists={labelArtists}
        revenues={revenues}
        bronzeBatchIds={bronzeBatchIds}
        disabled={persistDisabled}
      />

      <WorkflowStepper activeStep={activeStep} completedSteps={completedSteps} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <WorkflowSummaryCard
          label={t.settlementKpiApproved}
          value={kpis.approved}
          hint={t.settlementKpiApprovedHint}
          tone={kpis.approved > 0 ? 'success' : 'muted'}
        />
        <WorkflowSummaryCard
          label={t.settlementKpiViewed}
          value={kpis.viewed}
          hint={t.settlementKpiViewedHint}
          tone={kpis.viewed > 0 ? 'default' : 'muted'}
        />
        <WorkflowSummaryCard
          label={t.settlementKpiInvoiced}
          value={kpis.invoiced}
          hint={t.settlementKpiInvoicedHint}
          tone={kpis.invoiced > 0 ? 'default' : 'muted'}
        />
        <WorkflowSummaryCard
          label={t.settlementKpiReceived}
          value={kpis.received}
          hint={t.settlementKpiReceivedHint}
          tone={kpis.received > 0 ? 'default' : 'muted'}
        />
        <WorkflowSummaryCard
          label={t.settlementKpiPaid}
          value={kpis.paid}
          hint={t.settlementKpiPaidHint}
          tone={kpis.paid > 0 ? 'success' : 'muted'}
        />
        <div
          className={`rounded-lg border p-4 ${
            kpis.openBalanceEur > 0
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border bg-card/30'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.settlementOpenBalance}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtEur(kpis.openBalanceEur)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.settlementOpenBalanceHint}</p>
        </div>
      </div>
    </>
  )
}