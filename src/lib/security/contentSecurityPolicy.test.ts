import { describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  CONTENT_SECURITY_POLICY_DIRECTIVES,
  R2_UPLOAD_CONNECT_HOSTS,
} from './contentSecurityPolicy'

describe('contentSecurityPolicy', () => {
  it('includes R2 presigned upload hosts in connect-src', () => {
    const connectSrc = CONTENT_SECURITY_POLICY_DIRECTIVES['connect-src']
    for (const host of R2_UPLOAD_CONNECT_HOSTS) {
      expect(connectSrc).toContain(host)
    }
  })

  it('includes Supabase websocket and REST hosts', () => {
    const connectSrc = CONTENT_SECURITY_POLICY_DIRECTIVES['connect-src']
    expect(connectSrc).toContain('https://*.supabase.co')
    expect(connectSrc).toContain('wss://*.supabase.co')
  })

  it('includes Google Fonts in style-src and font-src', () => {
    expect(CONTENT_SECURITY_POLICY_DIRECTIVES['style-src']).toContain('https://fonts.googleapis.com')
    expect(CONTENT_SECURITY_POLICY_DIRECTIVES['font-src']).toContain('https://fonts.gstatic.com')
  })

  it('allows same-origin iframes for admin fan page review preview', () => {
    expect(CONTENT_SECURITY_POLICY_DIRECTIVES['frame-src']).toContain("'self'")
  })

  it('allows YouTube privacy-enhanced embeds in frame-src and script-src', () => {
    expect(CONTENT_SECURITY_POLICY_DIRECTIVES['frame-src']).toContain(
      'https://www.youtube-nocookie.com',
    )
    expect(CONTENT_SECURITY_POLICY_DIRECTIVES['script-src']).toContain(
      'https://www.youtube-nocookie.com',
    )
  })

  it('builds a valid semicolon-separated policy string', () => {
    const policy = buildContentSecurityPolicy()
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain('connect-src')
    expect(policy).toContain('https://*.r2.cloudflarestorage.com')
    expect(policy).toContain('https://www.youtube-nocookie.com')
    expect(policy.split(';').length).toBeGreaterThanOrEqual(8)
  })
})
it('requires nonce-authorized scripts on dynamic authenticated pages', () => {
  const policy = buildContentSecurityPolicy({ nonce: 'test-random-nonce' })
  const scripts = policy.split(';').find((directive) => directive.trim().startsWith('script-src'))
  expect(scripts).toContain("'nonce-test-random-nonce'")
  expect(scripts).toContain("'strict-dynamic'")
  expect(scripts).not.toContain("'unsafe-inline'")
  expect(scripts).not.toContain("'unsafe-eval'")
  expect(policy).toContain("object-src 'none'")
  expect(policy).toContain("base-uri 'self'")
})

it('rejects CSP directive injection through a nonce', () => {
  expect(() => buildContentSecurityPolicy({ nonce: "x'; script-src *" })).toThrow('Invalid CSP nonce')
})
