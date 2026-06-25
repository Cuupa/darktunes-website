'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, ArrowRight, List, UploadSimple, ChartBar, SealCheck } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  GUIDED_WIZARD_STEP_IDS,
  canAdvanceGuidedStep,
  canNavigateToGuidedStep,
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
  activeStep: GuidedWizardStep
  onActiveStepChange: (step: GuidedWizardStep) => void
  onSwitchToAdvanced: () => void
  uploadPanel: React.ReactNode
  reviewPanel: React.ReactNode
  settlePanel: React.ReactNode
  labels?: Partial<Record<keyof typeof GUIDED_FALLBACK, string>>
}

export function AccountingGuidedWizard({
  hasData,
  isProcessing,
  activeStep,
  onActiveStepChange,
  onSwitchToAdvanced,
  uploadPanel,
  reviewPanel,
  settlePanel,
  labels,
}: AccountingGuidedWizardProps) {
  const t = useMemo(() => ({ ...GUIDED_FALLBACK, ...labels }), [labels])
  const settlePanelRef = useRef<HTMLDivElement>(null)
  const stepInput = useMemo(() => ({ hasData, isProcessing }), [hasData, isProcessing])

  useEffect(() => {
    if (!hasData) {
      if (activeStep !== 'upload') onActiveStepChange('upload')
      return
    }

    const suggested = deriveSuggestedGuidedStep(stepInput)
    if (activeStep === 'upload' && suggested === 'review') {
      onActiveStepChange('review')
    }
  }, [activeStep, hasData, onActiveStepChange, stepInput])

  useEffect(() => {
    if (activeStep !== 'settle') return
    settlePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeStep])

  const stepHint = useMemo(() => {
    if (activeStep === 'upload') {
      return isProcessing ? t.guidedProcessingHint : t.guidedUploadHint
    }
    if (activeStep === 'review') return t.guidedReviewHint
    return t.guidedSettleHint
  }, [activeStep, isProcessing, t])

  const goBack = useCallback(() => {
    const index = guidedStepIndex(activeStep)
    if (index > 0) {
      const prev = GUIDED_WIZARD_STEP_IDS[index - 1]
      if (prev) onActiveStepChange(prev)
    }
  }, [activeStep, onActiveStepChange])

  const goNext = useCallback(() => {
    const index = guidedStepIndex(activeStep)
    const next = GUIDED_WIZARD_STEP_IDS[index + 1]
    if (next) onActiveStepChange(next)
  }, [activeStep, onActiveStepChange])

  const canGoNext = canAdvanceGuidedStep(activeStep, stepInput)
  const canGoBack = guidedStepIndex(activeStep) > 0
  const nextLabel = activeStep === 'review' ? t.guidedOpenSettle : t.guidedNext

  return (
    <div className="flex flex-col min-h-[500px]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border bg-muted/10">
        <nav aria-label={t.guidedStepperAria}>
          <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
            {GUIDED_WIZARD_STEP_IDS.map((id, index) => {
              const meta = STEP_META[id]
              const Icon = meta.icon
              const isActive = activeStep === id
              const isComplete = guidedStepIndex(activeStep) > index
              const canNavigate = canNavigateToGuidedStep(id, stepInput)
              return (
                <li key={id} className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canNavigate}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={t[meta.descKey]}
                    onClick={() => {
                      if (canNavigate) onActiveStepChange(id)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      isActive
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : isComplete
                          ? 'border-border bg-background text-muted-foreground hover:text-foreground'
                          : 'border-border/60 text-muted-foreground',
                      canNavigate ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {t[meta.labelKey]}
                  </button>
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
        {activeStep === 'upload' && uploadPanel}
        {activeStep === 'review' && reviewPanel}
        {activeStep === 'settle' && (
          <div ref={settlePanelRef} id="accounting-guided-settle-panel">
            {settlePanel}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 bg-muted/10">
        <Button type="button" variant="outline" size="sm" disabled={!canGoBack} onClick={goBack}>
          <ArrowLeft size={16} className="mr-1.5" aria-hidden="true" />
          {t.guidedBack}
        </Button>
        {activeStep !== 'settle' ? (
          <Button type="button" size="sm" disabled={!canGoNext} onClick={goNext}>
            {nextLabel}
            <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{t.guidedSettleHint}</span>
        )}
      </div>
    </div>
  )
}