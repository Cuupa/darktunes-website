import { describe, expect, it } from 'vitest'
import { hashSessionForPageEvents } from './sessionHash'

describe('hashSessionForPageEvents', () => {
  it('returns a stable hex digest for the same inputs', () => {
    const a = hashSessionForPageEvents('1.2.3.4', 'session-abc')
    const b = hashSessionForPageEvents('1.2.3.4', 'session-abc')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('differs when ip or session changes', () => {
    const base = hashSessionForPageEvents('1.2.3.4', 'session-abc')
    expect(hashSessionForPageEvents('5.6.7.8', 'session-abc')).not.toBe(base)
    expect(hashSessionForPageEvents('1.2.3.4', 'session-xyz')).not.toBe(base)
  })
})