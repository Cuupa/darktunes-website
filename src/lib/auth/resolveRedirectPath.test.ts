import { describe, expect, it } from 'vitest'
import {
  buildPasswordRecoveryVerifyUrl,
  getPasswordRecoveryClientLandingUrl,
  getPasswordRecoveryRedirectUrl,
  resolveRedirectPath,
} from './resolveRedirectPath'

describe('resolveRedirectPath', () => {
  it('routes admin and editor to /admin', () => {
    expect(resolveRedirectPath('admin')).toBe('/admin')
    expect(resolveRedirectPath('editor')).toBe('/admin')
  })

  it('routes artist to /portal', () => {
    expect(resolveRedirectPath('artist')).toBe('/portal')
  })

  it('routes journalist to press dashboard', () => {
    expect(resolveRedirectPath('journalist')).toBe('/press/dashboard')
  })

  it('falls back to /account for unknown roles', () => {
    expect(resolveRedirectPath('user')).toBe('/account')
    expect(resolveRedirectPath(null)).toBe('/account')
    expect(resolveRedirectPath(undefined)).toBe('/account')
  })
})

describe('getPasswordRecoveryRedirectUrl', () => {
  it('builds recovery URL without trailing slash', () => {
    expect(getPasswordRecoveryRedirectUrl('https://darktunes.com/')).toBe(
      'https://darktunes.com/auth/callback?recovery=1',
    )
  })
})

describe('buildPasswordRecoveryVerifyUrl', () => {
  it('builds a server-verifiable callback URL from hashed_token', () => {
    expect(buildPasswordRecoveryVerifyUrl('https://darktunes.com/', 'abc123hash')).toBe(
      'https://darktunes.com/auth/callback?recovery=1&token_hash=abc123hash&type=recovery',
    )
  })
})

describe('getPasswordRecoveryClientLandingUrl', () => {
  it('points Supabase fallback emails at the client hash handler', () => {
    expect(getPasswordRecoveryClientLandingUrl('https://darktunes.com/')).toBe(
      'https://darktunes.com/login?type=recovery',
    )
  })
})