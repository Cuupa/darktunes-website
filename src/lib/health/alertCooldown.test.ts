import { describe, it, expect } from 'vitest'
import { shouldDispatchCriticalAlerts } from './alertCooldown'

const NOW = new Date('2026-06-23T12:00:00.000Z').getTime()

describe('shouldDispatchCriticalAlerts', () => {
  it('dispatches when fingerprint changes', () => {
    const result = shouldDispatchCriticalAlerts(
      { lastSentAt: new Date(NOW - 5 * 60_000).toISOString(), fingerprint: 'db-offline' },
      'queue-failing',
      30 * 60_000,
      NOW,
    )
    expect(result.dispatch).toBe(true)
  })

  it('skips during cooldown for same fingerprint', () => {
    const result = shouldDispatchCriticalAlerts(
      { lastSentAt: new Date(NOW - 5 * 60_000).toISOString(), fingerprint: 'db-offline' },
      'db-offline',
      30 * 60_000,
      NOW,
    )
    expect(result.dispatch).toBe(false)
    expect(result.reason).toContain('cooldown_active')
  })

  it('dispatches after cooldown elapsed', () => {
    const result = shouldDispatchCriticalAlerts(
      { lastSentAt: new Date(NOW - 40 * 60_000).toISOString(), fingerprint: 'db-offline' },
      'db-offline',
      30 * 60_000,
      NOW,
    )
    expect(result.dispatch).toBe(true)
  })
})