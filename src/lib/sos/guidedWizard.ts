export type GuidedWizardStep = 'upload' | 'review' | 'settle'

export const GUIDED_WIZARD_STEP_IDS: readonly GuidedWizardStep[] = [
  'upload',
  'review',
  'settle',
] as const

export function deriveSuggestedGuidedStep(input: {
  hasData: boolean
  isProcessing: boolean
}): GuidedWizardStep {
  if (!input.hasData || input.isProcessing) return 'upload'
  return 'review'
}

export function guidedStepIndex(step: GuidedWizardStep): number {
  return GUIDED_WIZARD_STEP_IDS.indexOf(step)
}

export function canAdvanceGuidedStep(
  step: GuidedWizardStep,
  input: { hasData: boolean; isProcessing: boolean },
): boolean {
  if (step === 'upload') return input.hasData && !input.isProcessing
  if (step === 'review') return input.hasData
  return false
}