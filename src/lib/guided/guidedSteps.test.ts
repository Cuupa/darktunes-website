import { describe, expect, it } from 'vitest'
import {
  canAdvanceGuided,
  canNavigateToGuidedStep,
  guidedContinueBlockedReason,
  guidedStepIndex,
  isInvoiceableStatementStatus,
} from './guidedSteps'

const STEPS = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
] as const

describe('guidedSteps', () => {
  it('indexes steps', () => {
    expect(guidedStepIndex('b', STEPS)).toBe(1)
    expect(guidedStepIndex('x', STEPS)).toBe(-1)
  })

  it('gates advance on stepComplete', () => {
    expect(canAdvanceGuided('a', STEPS, { stepComplete: false })).toBe(false)
    expect(canAdvanceGuided('a', STEPS, { stepComplete: true })).toBe(true)
  })

  it('returns blocked reasons', () => {
    expect(
      guidedContinueBlockedReason('a', STEPS, {
        stepComplete: false,
        blockedReason: 'Need period',
      }),
    ).toBe('Need period')
    expect(guidedContinueBlockedReason('a', STEPS, { stepComplete: true })).toBeNull()
  })

  it('limits navigation by maxReachableIndex', () => {
    expect(canNavigateToGuidedStep('b', 'a', STEPS, 0)).toBe(false)
    expect(canNavigateToGuidedStep('a', 'a', STEPS, 0)).toBe(true)
    expect(canNavigateToGuidedStep('b', 'a', STEPS, 1)).toBe(true)
  })

  it('knows invoiceable statement statuses', () => {
    expect(isInvoiceableStatementStatus('label_approved')).toBe(true)
    expect(isInvoiceableStatementStatus('artist_notified')).toBe(true)
    expect(isInvoiceableStatementStatus('draft')).toBe(false)
  })
})
