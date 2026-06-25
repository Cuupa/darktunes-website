'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  WORKFLOW_STEP_IDS,
  type ArtistStatementWorkflowStatus,
  type StatementWorkflowStep,
} from '@/lib/sos/statementWorkflow'
import { Check, Circle } from '@phosphor-icons/react'
import { useAccountingMessages } from '@/lib/i18n/accountingFallbacks'

export interface WorkflowStepLabel {
  label: string
  description: string
}

export interface WorkflowLabels {
  stepperAriaLabel: string
  steps: Record<StatementWorkflowStep, WorkflowStepLabel>
  statuses: Record<ArtistStatementWorkflowStatus, string>
}

const WORKFLOW_STEP_FALLBACK: Record<StatementWorkflowStep, WorkflowStepLabel> = {
  review: { label: 'Review data', description: 'Validate CSV import and payouts in Reporting' },
  draft: { label: 'Drafts', description: 'Upload PDFs to the portal (no email)' },
  approve: { label: 'Approval', description: 'Label approval and artist notification' },
  notified: { label: 'Notified', description: 'Artist informed by email' },
  viewed: { label: 'Viewed', description: 'Artist opened the statement' },
  invoiced: { label: 'Invoice', description: 'Artist created an invoice' },
  paid: { label: 'Paid', description: 'Payment recorded and complete' },
}

const WORKFLOW_STATUS_FALLBACK: Record<ArtistStatementWorkflowStatus, string> = {
  not_linked: 'Not linked',
  not_uploaded: 'Ready for draft',
  draft: 'Approval pending',
  label_approved: 'Approved',
  artist_notified: 'Notified',
  viewed: 'Viewed',
  invoiced: 'Invoice created',
  paid: 'Paid',
  acknowledged: 'Acknowledged',
  superseded: 'Superseded',
  cancelled: 'Cancelled',
}

type WorkflowStepsDict = Partial<
  Record<StatementWorkflowStep, { label?: string; description?: string }>
>
type WorkflowStatusesDict = Partial<Record<ArtistStatementWorkflowStatus, string>>

function buildWorkflowLabels(
  accounting: {
    workflowStepperAria?: string
    workflowSteps?: WorkflowStepsDict
    workflowStatuses?: WorkflowStatusesDict
  } | undefined,
): WorkflowLabels {
  const steps = Object.fromEntries(
    WORKFLOW_STEP_IDS.map((id) => {
      const fromDict = accounting?.workflowSteps?.[id]
      const fallback = WORKFLOW_STEP_FALLBACK[id]
      return [
        id,
        {
          label: fromDict?.label ?? fallback.label,
          description: fromDict?.description ?? fallback.description,
        },
      ]
    }),
  ) as Record<StatementWorkflowStep, WorkflowStepLabel>

  const statuses = Object.fromEntries(
    (Object.keys(WORKFLOW_STATUS_FALLBACK) as ArtistStatementWorkflowStatus[]).map((id) => [
      id,
      accounting?.workflowStatuses?.[id] ?? WORKFLOW_STATUS_FALLBACK[id],
    ]),
  ) as Record<ArtistStatementWorkflowStatus, string>

  return {
    stepperAriaLabel: accounting?.workflowStepperAria ?? 'Statement approval workflow',
    steps,
    statuses,
  }
}

export function useWorkflowLabels(): WorkflowLabels {
  const accounting = useAccountingMessages()
  return buildWorkflowLabels(accounting)
}

export function WorkflowStepper({
  activeStep,
  completedSteps,
  labels: labelsProp,
}: {
  activeStep: StatementWorkflowStep
  completedSteps: Set<StatementWorkflowStep>
  labels?: WorkflowLabels
}) {
  const dictLabels = useWorkflowLabels()
  const labels = labelsProp ?? dictLabels
  const activeIndex = Math.max(
    0,
    WORKFLOW_STEP_IDS.findIndex((step) => step === activeStep),
  )

  return (
    <ol
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
      aria-label={labels.stepperAriaLabel}
    >
      {WORKFLOW_STEP_IDS.map((stepId, index) => {
        const step = labels.steps[stepId]
        const isComplete = completedSteps.has(stepId) || index < activeIndex
        const isActive = stepId === activeStep

        return (
          <li
            key={stepId}
            className={cn(
              'rounded-lg border p-4 transition-colors',
              isActive && 'border-primary/50 bg-primary/5',
              isComplete && !isActive && 'border-emerald-500/30 bg-emerald-500/5',
              !isActive && !isComplete && 'border-border bg-card/40',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  isComplete && 'border-emerald-500 bg-emerald-500 text-white',
                  isActive && !isComplete && 'border-primary bg-primary text-primary-foreground',
                  !isActive && !isComplete && 'border-border text-muted-foreground',
                )}
                aria-hidden="true"
              >
                {isComplete ? <Check size={14} weight="bold" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.label}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function WorkflowStatusBadge({
  status,
  labels: labelsProp,
}: {
  status: ArtistStatementWorkflowStatus
  labels?: WorkflowLabels
}) {
  const dictLabels = useWorkflowLabels()
  const labels = labelsProp ?? dictLabels

  const variant =
    status === 'draft'
      ? 'outline'
      : status === 'not_uploaded' || status === 'not_linked'
        ? 'secondary'
        : status === 'label_approved'
          ? 'default'
          : 'outline'

  const className =
    status === 'draft'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
      : status === 'not_uploaded'
        ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
        : status === 'not_linked'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : status === 'paid'
            ? 'bg-emerald-600/90 text-white'
            : status === 'invoiced' || status === 'acknowledged'
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-200'
              : status === 'viewed'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
                : status === 'artist_notified'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                  : status === 'label_approved'
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : status === 'superseded' || status === 'cancelled'
                      ? 'border-muted-foreground/30 bg-muted/40 text-muted-foreground'
                      : undefined

  return (
    <Badge variant={variant} className={className}>
      {labels.statuses[status]}
    </Badge>
  )
}

export function WorkflowSummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: number
  hint: string
  tone?: 'default' | 'warning' | 'success' | 'muted'
}) {
  const toneClass =
    tone === 'warning'
      ? 'border-amber-500/30 bg-amber-500/5'
      : tone === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : tone === 'muted'
          ? 'border-border bg-card/30'
          : 'border-primary/20 bg-primary/5'

  return (
    <div className={cn('rounded-lg border p-4', toneClass)}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function WorkflowProgressIcon({ complete }: { complete: boolean }) {
  return complete ? (
    <Check size={16} className="text-emerald-400" aria-hidden="true" />
  ) : (
    <Circle size={16} className="text-muted-foreground" aria-hidden="true" />
  )
}