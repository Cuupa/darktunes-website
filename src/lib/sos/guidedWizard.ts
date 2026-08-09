export type QuickWizardStep = 'upload' | 'review' | 'settle'

export type AssistantWizardStep = 'setup' | 'upload' | 'validate' | 'review' | 'settle'

export type GuidedWizardStep = QuickWizardStep | AssistantWizardStep

export const QUICK_WIZARD_STEP_IDS: readonly QuickWizardStep[] = [
  'upload',
  'review',
  'settle',
] as const

export const ASSISTANT_WIZARD_STEP_IDS: readonly AssistantWizardStep[] = [
  'setup',
  'upload',
  'validate',
  'review',
  'settle',
] as const

/** @deprecated Use QUICK_WIZARD_STEP_IDS */
export const GUIDED_WIZARD_STEP_IDS = QUICK_WIZARD_STEP_IDS

export type GuidedStepGateInput = {
  hasData: boolean
  isProcessing: boolean
  hasBlockingValidation?: boolean
  /** When false, Setup step cannot continue (invalid period / required fields). */
  setupComplete?: boolean
  /** When false, Upload cannot continue (exchange rates not loaded yet). */
  ratesReady?: boolean
}

export function deriveSuggestedGuidedStep(input: {
  hasData: boolean
  isProcessing: boolean
}): QuickWizardStep {
  if (!input.hasData || input.isProcessing) return 'upload'
  return 'review'
}

export function guidedStepIndex(
  step: GuidedWizardStep,
  stepIds: readonly GuidedWizardStep[],
): number {
  return stepIds.indexOf(step)
}

export function canAdvanceGuidedStep(
  step: GuidedWizardStep,
  input: GuidedStepGateInput,
  _stepIds: readonly GuidedWizardStep[] = QUICK_WIZARD_STEP_IDS,
): boolean {
  if (step === 'setup') return input.setupComplete !== false
  if (step === 'upload') {
    return (
      input.hasData &&
      !input.isProcessing &&
      input.ratesReady !== false
    )
  }
  if (step === 'validate') return input.hasData && !input.hasBlockingValidation
  if (step === 'review') return input.hasData
  return false
}

export function canNavigateToGuidedStep(
  target: GuidedWizardStep,
  input: { hasData: boolean; isProcessing: boolean },
  stepIds: readonly GuidedWizardStep[] = QUICK_WIZARD_STEP_IDS,
): boolean {
  const targetIndex = guidedStepIndex(target, stepIds)
  if (targetIndex < 0) return false
  if (target === 'setup' || target === 'upload') return true
  if (target === 'validate' || target === 'review' || target === 'settle') {
    return input.hasData && !input.isProcessing
  }
  return false
}

export type GuidedBlockedReasonLabels = {
  blockedSetupPeriod: string
  blockedUploadNoData: string
  blockedUploadProcessing: string
  blockedUploadRates: string
  blockedValidateErrors: string
  blockedReviewNoData: string
}

const BLOCKED_REASON_FALLBACK: GuidedBlockedReasonLabels = {
  blockedSetupPeriod: 'Select a valid billing period (start and end month) to continue.',
  blockedUploadNoData: 'Upload at least one sales file and wait until numbers appear.',
  blockedUploadProcessing: 'Please wait — files are still being processed.',
  blockedUploadRates: 'Please wait — exchange rates are still loading.',
  blockedValidateErrors: 'Fix the blocking errors in the checklist before continuing.',
  blockedReviewNoData: 'Upload and process sales files before publishing.',
}

/**
 * Human-readable reason Continue is disabled, or null when advance is allowed.
 */
export function guidedContinueBlockedReason(
  step: GuidedWizardStep,
  input: GuidedStepGateInput,
  labels: Partial<GuidedBlockedReasonLabels> = {},
): string | null {
  const t = { ...BLOCKED_REASON_FALLBACK, ...labels }
  if (canAdvanceGuidedStep(step, input)) return null

  if (step === 'setup') return t.blockedSetupPeriod
  if (step === 'upload') {
    if (input.ratesReady === false) return t.blockedUploadRates
    if (input.isProcessing) return t.blockedUploadProcessing
    return t.blockedUploadNoData
  }
  if (step === 'validate') {
    if (!input.hasData) return t.blockedUploadNoData
    if (input.hasBlockingValidation) return t.blockedValidateErrors
    return t.blockedUploadNoData
  }
  if (step === 'review') return t.blockedReviewNoData
  return null
}
