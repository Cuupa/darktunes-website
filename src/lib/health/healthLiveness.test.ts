import { describe, expect, it } from 'vitest'
import { deriveDatabaseHealth } from './healthLiveness'
import {
  DB_LATENCY_CRITICAL_MS,
  DB_LATENCY_WARN_MS,
} from './thresholds'

describe('deriveDatabaseHealth', () => {
  it('returns offline when database is unreachable', () => {
    const result = deriveDatabaseHealth(false, null)
    expect(result.status).toBe('offline')
    expect(result.statusLabel).toBe('Unreachable')
  })

  it('returns critical when latency exceeds critical threshold', () => {
    const result = deriveDatabaseHealth(true, DB_LATENCY_CRITICAL_MS)
    expect(result.status).toBe('critical')
    expect(result.statusLabel).toBe('Critical latency')
  })

  it('returns slow when latency exceeds warning threshold', () => {
    const result = deriveDatabaseHealth(true, DB_LATENCY_WARN_MS)
    expect(result.status).toBe('slow')
    expect(result.statusLabel).toBe('Elevated latency')
  })

  it('returns online for healthy latency', () => {
    const result = deriveDatabaseHealth(true, 42)
    expect(result.status).toBe('online')
    expect(result.statusLabel).toBe('Connected')
    expect(result.statusDetail).toContain('42ms')
  })
})