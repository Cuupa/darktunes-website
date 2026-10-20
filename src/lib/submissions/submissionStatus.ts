import type { SubmissionStatus } from '@/types'

const ALLOWED: Record<SubmissionStatus, readonly SubmissionStatus[]> = {
  received: ['reviewed', 'accepted', 'rejected'],
  reviewed: ['accepted', 'rejected'],
  accepted: ['rejected'],
  rejected: ['received'],
}

export function canTransitionSubmissionStatus(
  from: SubmissionStatus,
  to: SubmissionStatus,
): boolean {
  if (from === to) return true
  return ALLOWED[from].includes(to)
}

export function rejectionRequiresReply(to: SubmissionStatus): boolean {
  return to === 'rejected'
}
