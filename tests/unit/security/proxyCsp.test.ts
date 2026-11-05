import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../../../proxy'

vi.mock('@/lib/supabase/isConfigured', () => ({ isSupabaseEnvConfigured: () => false }))
afterEach(() => vi.unstubAllEnvs())

describe('dynamic page CSP boundary', () => {
  it('forwards the same fresh nonce to the renderer and browser', async () => {
    const request = new NextRequest('https://example.com/login', { headers: { 'x-nonce': 'attacker-value' } })
    const response = await proxy(request)
    const nonce = request.headers.get('x-nonce')
    expect(nonce).toMatch(/^[a-f0-9]{32}$/)
    expect(nonce).not.toBe('attacker-value')
    const csp = response.headers.get('content-security-policy')
    expect(csp).toContain(`'nonce-${nonce}'`)
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(csp)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })
  it('does not make public cached pages depend on an injected nonce', async () => {
    const request = new NextRequest('https://example.com/news', { headers: { 'x-nonce': 'attacker-value', 'content-security-policy': "script-src *" } })
    const response = await proxy(request)
    expect(request.headers.has('x-nonce')).toBe(false)
    expect(response.headers.get('content-security-policy')).toBeNull()
    expect(response.headers.get('cache-control')).not.toBe('private, no-store')
  })
})
