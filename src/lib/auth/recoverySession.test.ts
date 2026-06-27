import { describe, expect, it } from 'vitest'
import { isRecoverySessionEvent } from './recoverySession'

describe('isRecoverySessionEvent', () => {
  it('rejects INITIAL_SESSION unless server callback already exchanged the code', () => {
    expect(isRecoverySessionEvent('INITIAL_SESSION', { codeExchangeSucceeded: false })).toBe(false)
    expect(
      isRecoverySessionEvent('INITIAL_SESSION', {
        codeExchangeSucceeded: false,
        trustInitialSession: true,
      }),
    ).toBe(true)
  })

  it('accepts PASSWORD_RECOVERY from the reset link', () => {
    expect(isRecoverySessionEvent('PASSWORD_RECOVERY', { codeExchangeSucceeded: false })).toBe(true)
  })

  it('accepts SIGNED_IN only after a successful PKCE code exchange', () => {
    expect(isRecoverySessionEvent('SIGNED_IN', { codeExchangeSucceeded: false })).toBe(false)
    expect(isRecoverySessionEvent('SIGNED_IN', { codeExchangeSucceeded: true })).toBe(true)
  })
})