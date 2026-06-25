import { describe, expect, it } from 'vitest'
import {
  canAdvanceGuidedStep,
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

  it('orders steps upload → review → settle', () => {
    expect(guidedStepIndex('upload')).toBe(0)
    expect(guidedStepIndex('review')).toBe(1)
    expect(guidedStepIndex('settle')).toBe(2)
  })
})