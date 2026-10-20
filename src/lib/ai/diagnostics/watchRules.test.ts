import { describe, expect, it } from 'vitest'
import { evaluateWatchRules } from '@/lib/ai/diagnostics/watchRules'

describe('evaluateWatchRules', () => {
  it('should flag a fingerprint spike without calling a model', () => {
    const alerts = evaluateWatchRules({
      nowMs: Date.parse('2026-10-20T12:00:00.000Z'),
      appVersion: '1.6.0',
      logs: [
        {
          fingerprint: 'abc',
          occurrences: 12,
          first_seen_at: '2026-10-20T10:00:00.000Z',
          last_seen_at: '2026-10-20T11:50:00.000Z',
          source: 'api',
          message: 'boom',
          http_status: 500,
          app_version: '1.6.0',
        },
      ],
      failedSyncJobs: 0,
      uploadFailures: 0,
      serverErrors: 1,
    })
    expect(alerts.some((alert) => alert.id === 'ai-watch-fingerprint-spike')).toBe(true)
  })

  it('should stay quiet when logs are sparse', () => {
    const alerts = evaluateWatchRules({
      nowMs: Date.parse('2026-10-20T12:00:00.000Z'),
      appVersion: '1.6.0',
      logs: [],
      failedSyncJobs: 0,
      uploadFailures: 0,
      serverErrors: 0,
    })
    expect(alerts).toEqual([])
  })
})
