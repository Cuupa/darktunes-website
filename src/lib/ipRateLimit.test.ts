import { describe, it, expect, vi } from 'vitest'
import { checkRateLimit, getClientIp } from './ipRateLimit'

// The module uses a module-level Map — reset it between tests by re-importing
// after clearing the module cache, or by testing with unique keys per test.

describe('checkRateLimit', () => {
  // Use a unique IP prefix per test to avoid cross-test interference
  let testId = 0
  const ip = () => `10.0.0.${++testId}`

  it('allows the first request', () => {
    expect(checkRateLimit(ip(), 3, 60_000).limited).toBe(false)
  })

  it('allows requests up to the limit', () => {
    const testIp = ip()
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(testIp, 3, 60_000).limited).toBe(false)
    }
  })

  it('blocks the request that exceeds the limit', () => {
    const testIp = ip()
    // Call maxRequests times — all should pass
    for (let i = 0; i < 3; i++) {
      checkRateLimit(testIp, 3, 60_000)
    }
    // The 4th call exceeds limit
    expect(checkRateLimit(testIp, 3, 60_000).limited).toBe(true)
  })

  it('resets the counter after the window expires', () => {
    const testIp = ip()
    const windowMs = 100 // very short window for testing

    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      checkRateLimit(testIp, 3, windowMs)
    }
    expect(checkRateLimit(testIp, 3, windowMs).limited).toBe(true)

    // Fake time passing by directly setting the system clock
    vi.useFakeTimers()
    vi.advanceTimersByTime(200)

    // After window expiry the next call should reset
    expect(checkRateLimit(testIp, 3, windowMs).limited).toBe(false)

    vi.useRealTimers()
  })

  it('tracks different IPs independently', () => {
    const ip1 = ip()
    const ip2 = ip()

    for (let i = 0; i < 3; i++) {
      checkRateLimit(ip1, 3, 60_000)
    }
    // ip1 is now at limit; ip2 should still be free
    expect(checkRateLimit(ip1, 3, 60_000).limited).toBe(true)
    expect(checkRateLimit(ip2, 3, 60_000).limited).toBe(false)
  })
})

describe('getClientIp', () => {
  const makeRequest = (headers: Record<string, string>) =>
    new Request('http://localhost/api/test', { headers })

  it('reads the first IP from x-forwarded-for', () => {
    const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = makeRequest({ 'x-real-ip': '9.10.11.12' })
    expect(getClientIp(req)).toBe('9.10.11.12')
  })

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })
})
