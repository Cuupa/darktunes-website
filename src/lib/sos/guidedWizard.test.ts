import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_WIZARD_STEP_IDS,
  QUICK_WIZARD_STEP_IDS,
  canAdvanceGuidedStep,
  canNavigateToGuidedStep,
  deriveSuggestedGuidedStep,
  guidedStepIndex,
} from './guidedWizard'

describe('guidedWizard', () => {
  it('suggests upload when no data or still processing', () => {
    expect(deriveSuggestedGuidedStep({ hasData: false, isProcessing: false })).toBe('upload')
    expect(deriveSuggestedGuidedStep({ hasData: true, isProcessing: true })).toBe('upload')
  })

  it('suggests review when data is ready', () => {
    expect(deriveSuggestedGuidedStep({ hasData: true, isProcessing: false })).toBe('review')
  })

  it('gates advance from upload until processing completes', () => {
    expect(canAdvanceGuidedStep('upload', { hasData: false, isProcessing: false })).toBe(false)
    expect(canAdvanceGuidedStep('upload', { hasData: true, isProcessing: true })).toBe(false)
    expect(canAdvanceGuidedStep('upload', { hasData: true, isProcessing: false })).toBe(true)
  })

  it('blocks validate step when blocking validation issues exist', () => {
    expect(
      canAdvanceGuidedStep(
        'validate',
        { hasData: true, isProcessing: false, hasBlockingValidation: true },
        ASSISTANT_WIZARD_STEP_IDS,
      ),
    ).toBe(false)
    expect(
      canAdvanceGuidedStep(
        'validate',
        { hasData: true, isProcessing: false, hasBlockingValidation: false },
        ASSISTANT_WIZARD_STEP_IDS,
      ),
    ).toBe(true)
  })

  it('orders quick steps upload → review → settle', () => {
    expect(guidedStepIndex('upload', QUICK_WIZARD_STEP_IDS)).toBe(0)
    expect(guidedStepIndex('review', QUICK_WIZARD_STEP_IDS)).toBe(1)
    expect(guidedStepIndex('settle', QUICK_WIZARD_STEP_IDS)).toBe(2)
  })

  it('gates stepper navigation by data readiness', () => {
    const idle = { hasData: false, isProcessing: false }
    const processing = { hasData: true, isProcessing: true }
    const ready = { hasData: true, isProcessing: false }

    expect(canNavigateToGuidedStep('upload', idle)).toBe(true)
    expect(canNavigateToGuidedStep('review', idle)).toBe(false)
    expect(canNavigateToGuidedStep('settle', idle)).toBe(false)

    expect(canNavigateToGuidedStep('review', processing)).toBe(false)
    expect(canNavigateToGuidedStep('settle', processing)).toBe(false)

    expect(canNavigateToGuidedStep('review', ready)).toBe(true)
    expect(canNavigateToGuidedStep('settle', ready)).toBe(true)
  })
})