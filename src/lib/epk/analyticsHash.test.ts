import { describe, expect, it } from 'vitest'
import { hashIpForAnalytics } from './analyticsHash'

describe('hashIpForAnalytics', () => {
  it('returns a stable SHA-256 hex digest', () => {
    const a = hashIpForAnalytics('203.0.113.1')
    const b = hashIpForAnalytics('203.0.113.1')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('differs for different IPs', () => {
    expect(hashIpForAnalytics('203.0.113.1')).not.toBe(hashIpForAnalytics('203.0.113.2'))
  })
})