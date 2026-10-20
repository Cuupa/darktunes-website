import { describe, expect, it } from 'vitest'
import { developerErrorReportSchema } from '@/lib/ai/validation/developerReport'

describe('developerErrorReportSchema', () => {
  it('should require explicit confidence labels instead of a probability', () => {
    const parsed = developerErrorReportSchema.safeParse({
      title: 'Sync failed',
      error_id: 'ERR-1',
      fingerprint: 'abc',
      severity: 'high',
      status: 'open',
      affected_page: '/admin/system',
      affected_feature: 'sync',
      first_seen_at: null,
      last_seen_at: null,
      occurrences: 3,
      affected_user_count: null,
      app_version: '1.6.0',
      deployment: null,
      expected_behavior: 'Sync completes',
      actual_behavior: 'Spotify 401',
      reproduction_steps: ['Open System', 'Force sync'],
      relevant_messages: ['401'],
      correlations: [],
      probable_causes: [{ hypothesis: 'Expired Spotify secret', confidence: 'likely', evidence: ['HTTP 401'] }],
      missing_information: ['Last successful sync time'],
      recommended_actions: ['Rotate the Spotify client secret'],
      possible_regression: false,
      test_suggestions: ['POST /api/sync with a valid token'],
      diagnosis_confidence: 'likely',
    })
    expect(parsed.success).toBe(true)
  })
})
