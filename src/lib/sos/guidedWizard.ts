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
  input: { hasData: boolean; isProcessing: boolean; hasBlockingValidation?: boolean },
  _stepIds: readonly GuidedWizardStep[] = QUICK_WIZARD_STEP_IDS,
): boolean {
  if (step === 'setup') return true
  if (step === 'upload') return input.hasData && !input.isProcessing
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