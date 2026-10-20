import { describe, expect, it } from 'vitest'
import { buildDeveloperErrorReport } from '@/lib/ai/diagnostics/buildReport'

describe('buildDeveloperErrorReport', () => {
  it('should mark guesses as possible and not invent file paths', () => {
    const report = buildDeveloperErrorReport({
      errorId: 'ERR-ABC',
      log: {
        message: 'Spotify sync failed',
        source: 'sync',
        fingerprint: 'fp-1',
        http_status: 500,
        route_path: '/api/sync',
        occurrences: 4,
        resolved: false,
      },
    })
    expect(report.diagnosis_confidence).toBe('possible')
    expect(report.missing_information.some((item) => item.includes('source maps'))).toBe(true)
    expect(JSON.stringify(report)).not.toContain('src/lib/sync')
  })
})
