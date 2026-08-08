'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  List,
  UploadSimple,
  ChartBar,
  SealCheck,
  Gear,
  ShieldCheck,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  QUICK_WIZARD_STEP_IDS,
  canAdvanceGuidedStep,
  canNavigateToGuidedStep,
  guidedContinueBlockedReason,
  guidedStepIndex,
  type GuidedBlockedReasonLabels,
  type GuidedWizardStep,
} from '@/lib/sos/guidedWizard'
import { SosWizardStepCoach } from '@/components/admin/sos/SosWizardStepCoach'
import { cn } from '@/lib/utils'

const GUIDED_FALLBACK = {
  guidedModeLabel: 'Guided',
  advancedModeLabel: 'Advanced',
  guidedSwitchAdvanced: 'Switch to advanced mode',
  guidedStepSetup: 'Setup',
  guidedStepSetupDesc: 'Period and accounting parameters',
  guidedStepUpload: 'Upload',
  guidedStepUploadDesc: 'Import sales CSV files',
  guidedStepValidate: 'Checks',
  guidedStepValidateDesc: 'Automatic checks before payout review',
  guidedStepReview: 'Payouts',
  guidedStepReviewDesc: 'Check amounts before publishing',
  guidedStepSettle: 'Publish',
  guidedStepSettleDesc: 'Create drafts, approve, and pay',
  guidedBack: 'Back',
  guidedNext: 'Continue',
  guidedOpenSettle: 'Continue to publish',
  guidedProcessingHint: 'Processing CSV data…',
  guidedUploadHint: 'Upload at least one sales CSV to continue.',
  guidedReviewHint: 'Check artist payouts, then continue to publish statements.',
  guidedSettleHint: 'Create drafts, approve them, then record payments below.',
  guidedStepperAria: 'Accounting guided workflow',
  guidedStepOf: 'Step {current} of {total}',
  blockedSetupPeriod: 'Select a valid billing period (start and end month) to continue.',
  blockedUploadNoData: 'Upload at least one sales file and wait until numbers appear.',
  blockedUploadProcessing: 'Please wait — files are still being processed.',
  blockedUploadRates: 'Please wait — exchange rates are still loading.',
  blockedValidateErrors: 'Fix the blocking errors in the checklist before continuing.',
  blockedReviewNoData: 'Upload and process sales files before publishing.',
} as const

const STEP_META: Record<
  GuidedWizardStep,
  { icon: typeof UploadSimple; labelKey: keyof typeof GUIDED_FALLBACK; descKey: keyof typeof GUIDED_FALLBACK }
> = {
  setup: {
    icon: Gear,
    labelKey: 'guidedStepSetup',
    descKey: 'guidedStepSetupDesc',
  },
  upload: {
    icon: UploadSimple,
    labelKey: 'guidedStepUpload',
    descKey: 'guidedStepUploadDesc',
  },
  validate: {
    icon: ShieldCheck,
    labelKey: 'guidedStepValidate',
    descKey: 'guidedStepValidateDesc',
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
  onImportReady?: () => void
  stepIds?: readonly GuidedWizardStep[]
  hasBlockingValidation?: boolean
  /** When false, Continue is disabled on the Setup step. Default true. */
  setupComplete?: boolean
  ratesReady?: boolean
  exchangeRatesLoading?: boolean
  revenueCount?: number
  issueCount?: number
  /** Extra content under the coach (e.g. FX banner). */
  statusBanner?: React.ReactNode
  setupPanel?: React.ReactNode
  uploadPanel: React.ReactNode
  validatePanel?: React.ReactNode
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
  onImportReady,
  stepIds = QUICK_WIZARD_STEP_IDS,
  hasBlockingValidation = false,
  setupComplete = true,
  ratesReady = true,
  exchangeRatesLoading = false,
  revenueCount = 0,
  issueCount = 0,
  statusBanner,
  setupPanel,
  uploadPanel,
  validatePanel,
  reviewPanel,
  settlePanel,
  labels,
}: AccountingGuidedWizardProps) {
  const t = useMemo(() => ({ ...GUIDED_FALLBACK, ...labels }), [labels])
  const settlePanelRef = useRef<HTMLDivElement>(null)
  const stepInput = useMemo(
    () => ({
      hasData,
      isProcessing,
      hasBlockingValidation,
      setupComplete,
      ratesReady,
    }),
    [hasData, isProcessing, hasBlockingValidation, setupComplete, ratesReady],
  )
  const importReadyNotifiedRef = useRef(false)

  useEffect(() => {
    if (!hasData) {
      importReadyNotifiedRef.current = false
      return
    }

    if (!isProcessing && activeStep === 'upload' && !importReadyNotifiedRef.current) {
      importReadyNotifiedRef.current = true
      onImportReady?.()
    }
  }, [activeStep, hasData, isProcessing, onImportReady])

  useEffect(() => {
    if (activeStep !== 'settle') return
    settlePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeStep])

  const blockedReasonLabels = useMemo((): GuidedBlockedReasonLabels => ({
    blockedSetupPeriod: t.blockedSetupPeriod,
    blockedUploadNoData: t.blockedUploadNoData,
    blockedUploadProcessing: t.blockedUploadProcessing,
    blockedUploadRates: t.blockedUploadRates,
    blockedValidateErrors: t.blockedValidateErrors,
    blockedReviewNoData: t.blockedReviewNoData,
  }), [t])

  const blockedReason = useMemo(
    () => guidedContinueBlockedReason(activeStep, stepInput, blockedReasonLabels),
    [activeStep, stepInput, blockedReasonLabels],
  )

  const stepHint = useMemo(() => {
    if (activeStep === 'setup') {
      return t.guidedStepSetupDesc
    }
    if (activeStep === 'upload') {
      return isProcessing ? t.guidedProcessingHint : t.guidedUploadHint
    }
    if (activeStep === 'validate') {
      return t.guidedStepValidateDesc
    }
    if (activeStep === 'review') return t.guidedReviewHint
    return t.guidedSettleHint
  }, [activeStep, isProcessing, t])

  const goBack = useCallback(() => {
    const index = guidedStepIndex(activeStep, stepIds)
    if (index > 0) {
      const prev = stepIds[index - 1]
      if (prev) onActiveStepChange(prev)
    }
  }, [activeStep, onActiveStepChange, stepIds])

  const goNext = useCallback(() => {
    const index = guidedStepIndex(activeStep, stepIds)
    const next = stepIds[index + 1]
    if (next) onActiveStepChange(next)
  }, [activeStep, onActiveStepChange, stepIds])

  const canGoNext = canAdvanceGuidedStep(activeStep, stepInput, stepIds)
  const canGoBack = guidedStepIndex(activeStep, stepIds) > 0
  const nextLabel = activeStep === 'review' ? t.guidedOpenSettle : t.guidedNext
  const stepNumber = guidedStepIndex(activeStep, stepIds) + 1
  const stepProgress = t.guidedStepOf
    .replace('{current}', String(stepNumber))
    .replace('{total}', String(stepIds.length))
  const activeStepLabel = t[STEP_META[activeStep].labelKey]

  return (
    <div className="flex flex-col min-h-[500px]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-border bg-muted/10">
        <nav aria-label={t.guidedStepperAria}>
          <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
            {stepIds.map((id, index) => {
              const meta = STEP_META[id]
              const Icon = meta.icon
              const isActive = activeStep === id
              const isComplete = guidedStepIndex(activeStep, stepIds) > index
              const canNavigate = canNavigateToGuidedStep(id, stepInput, stepIds)
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
                  {index < stepIds.length - 1 && (
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

      {statusBanner}

      <SosWizardStepCoach
        step={activeStep}
        hasData={hasData}
        isProcessing={isProcessing}
        setupComplete={setupComplete}
        hasBlockingValidation={hasBlockingValidation}
        ratesReady={ratesReady}
        exchangeRatesLoading={exchangeRatesLoading}
        revenueCount={revenueCount}
        issueCount={issueCount}
        blockedReason={activeStep === 'settle' ? null : blockedReason}
      />

      <Alert className="mx-6 mt-3 border-border bg-card/40">
        <AlertDescription className="text-xs">{stepHint}</AlertDescription>
      </Alert>

      <div className="flex-1">
        {activeStep === 'setup' && setupPanel}
        {activeStep === 'upload' && uploadPanel}
        {activeStep === 'validate' && validatePanel}
        {activeStep === 'review' && reviewPanel}
        {activeStep === 'settle' && (
          <div ref={settlePanelRef} id="accounting-guided-settle-panel">
            {settlePanel}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 bg-card/40">
        <div className="flex flex-col gap-1 min-w-0">
          <Button type="button" variant="outline" disabled={!canGoBack} onClick={goBack} className="min-h-11 w-fit">
            <ArrowLeft size={16} className="mr-1.5" aria-hidden="true" />
            {t.guidedBack}
          </Button>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {stepProgress} · {activeStepLabel}
          </span>
        </div>
        {activeStep !== 'settle' ? (
          <div className="flex flex-col items-end gap-1 max-w-sm">
            <Button type="button" disabled={!canGoNext} onClick={goNext} className="min-h-11">
              {nextLabel}
              <ArrowRight size={16} className="ml-1.5" aria-hidden="true" />
            </Button>
            {!canGoNext && blockedReason && (
              <p className="text-[11px] text-muted-foreground text-right leading-snug" role="status">
                {blockedReason}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{t.guidedSettleHint}</span>
        )}
      </div>
    </div>
  )
}
