'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, List, UploadSimple, ChartBar, SealCheck } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  GUIDED_WIZARD_STEP_IDS,
  canAdvanceGuidedStep,
  deriveSuggestedGuidedStep,
  guidedStepIndex,
  type GuidedWizardStep,
} from '@/lib/sos/guidedWizard'
import { cn } from '@/lib/utils'

const GUIDED_FALLBACK = {
  guidedModeLabel: 'Guided',
  advancedModeLabel: 'Advanced',
  guidedSwitchAdvanced: 'Switch to advanced mode',
  guidedStepUpload: 'Upload',
  guidedStepUploadDesc: 'Import distributor CSV files',
  guidedStepReview: 'Review',
  guidedStepReviewDesc: 'Validate payouts before publishing',
  guidedStepSettle: 'Publish',
  guidedStepSettleDesc: 'Save analytics, create drafts, and approve',
  guidedBack: 'Back',
  guidedNext: 'Continue',
  guidedOpenSettle: 'Open settlement',
  guidedProcessingHint: 'Processing CSV data…',
  guidedUploadHint: 'Upload at least one distributor CSV to continue.',
  guidedReviewHint: 'Check artist payouts, then continue to publish statements.',
  guidedSettleHint: 'Save portal analytics and run the settlement workflow below.',
  guidedStepperAria: 'Accounting guided workflow',
} as const

const STEP_META: Record<
  GuidedWizardStep,
  { icon: typeof UploadSimple; labelKey: keyof typeof GUIDED_FALLBACK; descKey: keyof typeof GUIDED_FALLBACK }
> = {
  upload: {
    icon: UploadSimple,
    labelKey: 'guidedStepUpload',
    descKey: 'guidedStepUploadDesc',
  },
  review: {
    icon: ChartBar,
    labelKey: 'guidedStepReview',
    descKey: 'guidedStepReviewDesc',
  },
  settle: {
    icon: SealCheck,
    labelKey: 'guidedStepSettle',
    descKey: 'guidedStepSettleDesc',
  },
}

export interface AccountingGuidedWizardProps {
  hasData: boolean
  isProcessing: boolean
  onSwitchToAdvanced: () => void
  uploadPanel: React.ReactNode
  reviewPanel: React.ReactNode
  settlePanel: React.ReactNode
  labels?: Partial<Record<keyof typeof GUIDED_FALLBACK, string>>
}

export function AccountingGuidedWizard({
  hasData,
  isProcessing,
  onSwitchToAdvanced,
  uploadPanel,
  reviewPanel,
  settlePanel,
  labels,
}: AccountingGuidedWizardProps) {
  const t = useMemo(() => ({ ...GUIDED_FALLBACK, ...labels }), [labels])
  const [step, setStep] = useState<GuidedWizardStep>('upload')

  useEffect(() => {
    setStep((current) => {
      const suggested = deriveSuggestedGuidedStep({ hasData, isProcessing })
      if (!hasData) return 'upload'
      if (current === 'upload' && suggested === 'review') return 'review'
      return current
    })
  }, [hasData, isProcessing])

  const stepHint = useMemo(() => {
    if (step === 'upload') {
      return isProcessing ? t.guidedProcessingHint : t.guidedUploadHint
    }
    if (step === 'review') return t.guidedReviewHint
    return t.guidedSettleHint
  }, [isProcessing, step, t])

  const goBack = useCallback(() => {
    const index = guidedStepIndex(step)
    if (index > 0) {
      const prev = GUIDED_WIZARD_STEP_IDS[index - 1]
      if (prev) setStep(prev)
    }
  }, [step])

  const goNext = useCallback(() => {
    const index = guidedStepIndex(step)
    const next = GUIDED_WIZARD_STEP_IDS[index + 1]
    if (next) setStep(next)
  }, [step])

  const canGoNext = canAdvanceGuidedStep(step, { hasData, isProcessing })
  const canGoBack = guidedStepIndex(step) > 0

  return (
    <div className="flex flex-col min-h-[500px]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border bg-muted/10">
        <nav aria-label={t.guidedStepperAria}>
          <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
            {GUIDED_WIZARD_STEP_IDS.map((id, index) => {
              const meta = STEP_META[id]
              const Icon = meta.icon
              const isActive = step === id
              const isComplete = guidedStepIndex(step) > index
              return (
                <li key={id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                      isActive
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : isComplete
                          ? 'border-border bg-background text-muted-foreground'
                          : 'border-border/60 text-muted-foreground',
                    )}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {t[meta.labelKey]}
                  </span>
                  {index < GUIDED_WIZARD_STEP_IDS.length - 1 && (
                    <span className="hidden sm:inline text-muted-foreground" aria-hidden="true">
                      →
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
          onClick={onSwitchToAdvanced}
        >
          <List size={14} aria-hidden="true" />
          {t.guidedSwitchAdvanced}
        </Button>
      </div>

      <Alert className="mx-6 mt-4 border-border bg-card/40">
        <AlertDescription className="text-xs">{stepHint}</AlertDescription>
      </Alert>

      <div className="flex-1">
        {step === 'upload' && uploadPanel}
        {step === 'review' && reviewPanel}
        {step === 'settle' && settlePanel}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 bg-muted/10">
        <Button type="button" variant="outline" size="sm" disabled={!canGoBack} onClick={goBack}>
          <ArrowLeft size={16} className="mr-1.5" aria-hidden="true" />
          {t.guidedBack}
        </Button>
        {step !== 'settle' ? (
          <Button type="button" size="sm" disabled={!canGoNext} onClick={goNext}>
            {t.guidedNext}
            <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{t.guidedSettleHint}</span>
        )}
      </div>
    </div>
  )
}