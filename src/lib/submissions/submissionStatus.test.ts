import { describe, expect, it } from 'vitest'
import { canTransitionSubmissionStatus, rejectionRequiresReply } from './submissionStatus'

describe('canTransitionSubmissionStatus', () => {
  it('allows received to reviewed, accepted, or rejected', () => {
    expect(canTransitionSubmissionStatus('received', 'accepted')).toBe(true)
    expect(canTransitionSubmissionStatus('received', 'rejected')).toBe(true)
    expect(canTransitionSubmissionStatus('received', 'reviewed')).toBe(true)
  })

  it('allows accepted to rejected only', () => {
    expect(canTransitionSubmissionStatus('accepted', 'rejected')).toBe(true)
    expect(canTransitionSubmissionStatus('accepted', 'received')).toBe(false)
    expect(canTransitionSubmissionStatus('accepted', 'reviewed')).toBe(false)
  })

  it('allows rejected back to received for artist resubmit', () => {
    expect(canTransitionSubmissionStatus('rejected', 'received')).toBe(true)
    expect(canTransitionSubmissionStatus('rejected', 'accepted')).toBe(false)
  })

  it('treats same status as allowed', () => {
    expect(canTransitionSubmissionStatus('accepted', 'accepted')).toBe(true)
  })
})

describe('rejectionRequiresReply', () => {
  it('is true only for rejected', () => {
    expect(rejectionRequiresReply('rejected')).toBe(true)
    expect(rejectionRequiresReply('accepted')).toBe(false)
  })
})
