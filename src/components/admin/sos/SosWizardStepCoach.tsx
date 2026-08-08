'use client'

import { CheckCircle, Circle, Warning } from '@phosphor-icons/react'
import type { GuidedWizardStep } from '@/lib/sos/guidedWizard'
import { useAccountingLabels } from '@/lib/i18n/accountingFallbacks'
import { interpolate } from '@/lib/i18n/interpolate'
import { cn } from '@/lib/utils'

export interface SosWizardStepCoachProps {
  step: GuidedWizardStep
  hasData: boolean
  isProcessing: boolean
  setupComplete: boolean
  hasBlockingValidation: boolean
  ratesReady: boolean
  exchangeRatesLoading: boolean
  revenueCount: number
  issueCount: number
  blockedReason: string | null
  className?: string
}

type CheckItem = { id: string; label: string; done: boolean }

export function SosWizardStepCoach({
  step,
  hasData,
  isProcessing,
  setupComplete,
  hasBlockingValidation,
  ratesReady,
  exchangeRatesLoading,
  revenueCount,
  issueCount,
  blockedReason,
  className,
}: SosWizardStepCoachProps) {
  const t = useAccountingLabels()

  const { title, body, checks } = coachContent(step, t, {
    hasData,
    isProcessing,
    setupComplete,
    hasBlockingValidation,
    ratesReady,
    exchangeRatesLoading,
    revenueCount,
    issueCount,
  })

  return (
    <div
      className={cn(
        'mx-6 mt-4 rounded-lg border border-border bg-card/50 p-4 space-y-3',
        className,
      )}
      aria-label={title}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
      </div>
      {checks.length > 0 && (
        <ul className="space-y-1.5" role="list">
          {checks.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              {item.done ? (
                <CheckCircle
                  size={14}
                  className="text-emerald-400 shrink-0 mt-0.5"
                  weight="fill"
                  aria-hidden="true"
                />
              ) : (
                <Circle size={14} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span className={item.done ? 'text-muted-foreground' : 'text-foreground'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      )}
      {blockedReason && (
        <p
          className="flex items-start gap-2 text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2"
          role="status"
        >
          <Warning size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{blockedReason}</span>
        </p>
      )}
    </div>
  )
}

function coachContent(
  step: GuidedWizardStep,
  t: ReturnType<typeof useAccountingLabels>,
  state: {
    hasData: boolean
    isProcessing: boolean
    setupComplete: boolean
    hasBlockingValidation: boolean
    ratesReady: boolean
    exchangeRatesLoading: boolean
    revenueCount: number
    issueCount: number
  },
): { title: string; body: string; checks: CheckItem[] } {
  switch (step) {
    case 'setup':
      return {
        title: t.coachSetupTitle,
        body: t.coachSetupBody,
        checks: [
          { id: 'period', label: t.coachCheckPeriod, done: state.setupComplete },
          { id: 'fees', label: t.coachCheckFees, done: true },
          { id: 'label', label: t.coachCheckLabel, done: true },
        ],
      }
    case 'upload':
      return {
        title: t.coachUploadTitle,
        body: t.coachUploadBody,
        checks: [
          {
            id: 'rates',
            label: t.coachCheckRates,
            done: state.ratesReady && !state.exchangeRatesLoading,
          },
          { id: 'files', label: t.coachCheckFiles, done: state.hasData || state.isProcessing },
          { id: 'processed', label: t.coachCheckProcessed, done: state.hasData && !state.isProcessing },
        ],
      }
    case 'validate':
      return {
        title: t.coachValidateTitle,
        body: t.coachValidateBody,
        checks: [
          { id: 'data', label: t.coachCheckProcessed, done: state.hasData },
          {
            id: 'errors',
            label: t.coachCheckNoBlocking,
            done: state.hasData && !state.hasBlockingValidation,
          },
          {
            id: 'issues',
            label:
              state.issueCount > 0
                ? interpolate(t.coachCheckIssuesCount, { count: state.issueCount })
                : t.coachCheckNoIssues,
            done: state.issueCount === 0,
          },
        ],
      }
    case 'review':
      return {
        title: t.coachReviewTitle,
        body: t.coachReviewBody,
        checks: [
          {
            id: 'payouts',
            label: interpolate(t.coachCheckPayouts, { count: state.revenueCount }),
            done: state.hasData,
          },
        ],
      }
    case 'settle':
      return {
        title: t.coachSettleTitle,
        body: t.coachSettleBody,
        checks: [
          { id: 'drafts', label: t.coachCheckDrafts, done: false },
          { id: 'approve', label: t.coachCheckApprove, done: false },
          { id: 'pay', label: t.coachCheckPay, done: false },
        ],
      }
    default:
      return { title: '', body: '', checks: [] }
  }
}
