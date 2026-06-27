import { describe, expect, it } from 'vitest'
import { isRecoverySessionEvent, sessionHasRecoveryAmr } from './recoverySession'

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

describe('isRecoverySessionEvent', () => {
  it('rejects INITIAL_SESSION without a verified server exchange', () => {
    expect(isRecoverySessionEvent('INITIAL_SESSION', { serverExchangeSucceeded: false })).toBe(
      false,
    )
  })

  it('accepts INITIAL_SESSION after /auth/callback exchanged the recovery code', () => {
    expect(isRecoverySessionEvent('INITIAL_SESSION', { serverExchangeSucceeded: true })).toBe(true)
  })

  it('accepts PASSWORD_RECOVERY from the reset link', () => {
    expect(isRecoverySessionEvent('PASSWORD_RECOVERY', { serverExchangeSucceeded: false })).toBe(
      true,
    )
  })

  it('accepts SIGNED_IN only after a successful server code exchange', () => {
    expect(isRecoverySessionEvent('SIGNED_IN', { serverExchangeSucceeded: false })).toBe(false)
    expect(isRecoverySessionEvent('SIGNED_IN', { serverExchangeSucceeded: true })).toBe(true)
  })
})

describe('sessionHasRecoveryAmr', () => {
  it('returns true when amr contains recovery', () => {
    const token = makeJwt({ amr: [{ method: 'recovery', timestamp: 1_640_991_600 }] })
    expect(sessionHasRecoveryAmr(token)).toBe(true)
  })

  it('returns false for a normal password session', () => {
    const token = makeJwt({ amr: [{ method: 'password', timestamp: 1_640_991_600 }] })
    expect(sessionHasRecoveryAmr(token)).toBe(false)
  })

  it('returns false for missing or malformed tokens', () => {
    expect(sessionHasRecoveryAmr(undefined)).toBe(false)
    expect(sessionHasRecoveryAmr('not-a-jwt')).toBe(false)
  })
})