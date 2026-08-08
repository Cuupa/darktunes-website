/**
 * Domain-agnostic guided-step helpers for portal/admin assistants.
 */

export type GuidedMode = 'assistant' | 'advanced'

export interface GuidedStepDef {
  id: string
  label: string
}

export interface GuidedGateInput {
  /** Per-step readiness; if false for active step, Continue is blocked. */
  stepComplete: boolean
  /** Optional extra reason when incomplete. */
  blockedReason?: string | null
}

export function guidedStepIndex(stepId: string, steps: readonly GuidedStepDef[]): number {
  return steps.findIndex((s) => s.id === stepId)
}

export function canAdvanceGuided(
  stepId: string,
  steps: readonly GuidedStepDef[],
  input: GuidedGateInput,
): boolean {
  const index = guidedStepIndex(stepId, steps)
  if (index < 0) return false
  // Last step: "advance" means finish — still requires step complete.
  return input.stepComplete
}

export function canNavigateToGuidedStep(
  targetId: string,
  activeId: string,
  steps: readonly GuidedStepDef[],
  maxReachableIndex: number,
): boolean {
  const targetIndex = guidedStepIndex(targetId, steps)
  if (targetIndex < 0) return false
  if (targetIndex <= maxReachableIndex) return true
  // Always allow current
  return targetId === activeId
}

export function guidedContinueBlockedReason(
  stepId: string,
  steps: readonly GuidedStepDef[],
  input: GuidedGateInput,
  fallback = 'Complete this step to continue.',
): string | null {
  if (canAdvanceGuided(stepId, steps, input)) return null
  return input.blockedReason?.trim() || fallback
}

export function clampGuidedIndex(index: number, steps: readonly GuidedStepDef[]): number {
  if (steps.length === 0) return 0
  return Math.max(0, Math.min(index, steps.length - 1))
}

/** Invoiceable statement statuses (portal API + UI SSOT). */
export const INVOICEABLE_STATEMENT_STATUSES = [
  'label_approved',
  'artist_notified',
  'viewed',
] as const

export type InvoiceableStatementStatus = (typeof INVOICEABLE_STATEMENT_STATUSES)[number]

export function isInvoiceableStatementStatus(status: string): boolean {
  return (INVOICEABLE_STATEMENT_STATUSES as readonly string[]).includes(status)
}
