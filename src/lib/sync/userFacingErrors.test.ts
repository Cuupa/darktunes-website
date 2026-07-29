import { describe, it, expect } from 'vitest'
import { describeJobError, describeSyncQueueIssue } from './userFacingErrors'

describe('describeSyncQueueIssue', () => {
  it('explains executor offline with backlog', () => {
    const issues = describeSyncQueueIssue({
      executorNeverRan: false,
      executorOffline: true,
      backlog: 3,
      youtubeUnconfigured: false,
      youtubeIdle: false,
      cronSecretMissing: false,
    })
    expect(issues.some((i) => i.title === 'Executor offline')).toBe(true)
    expect(issues[0]?.fixHint).toMatch(/process-queue|CRON_SECRET/i)
  })
})

describe('describeJobError', () => {
  it('maps rate limit messages', () => {
    expect(describeJobError('Rate limited — rescheduled')).toMatch(/cooldown/i)
  })
})
