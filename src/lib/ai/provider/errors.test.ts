import { describe, expect, it } from 'vitest'
import {
  AiProviderError,
  parseRetryAfterMs,
  providerErrorFromHttpStatus,
  providerErrorFromNetwork,
} from '@/lib/ai/provider/errors'

describe('AiProviderError', () => {
  it('should mark 429 as retryable and parse Retry-After seconds', () => {
    const error = providerErrorFromHttpStatus(429, '{"error":{"message":"slow down"}}', '2')
    expect(error.code).toBe('RATE_LIMITED')
    expect(error.retryable).toBe(true)
    expect(error.retryAfterMs).toBe(2000)
    expect(error.message).toContain('slow down')
  })

  it('should map 401 to INVALID_KEY and not retry', () => {
    const error = providerErrorFromHttpStatus(401, 'unauthorized', null)
    expect(error.code).toBe('INVALID_KEY')
    expect(error.retryable).toBe(false)
  })

  it('should map TLS failures separately from generic network errors', () => {
    const tls = providerErrorFromNetwork(new Error('unable to verify the first certificate'))
    expect(tls.code).toBe('TLS_ERROR')
    const net = providerErrorFromNetwork(new Error('fetch failed'))
    expect(net.code).toBe('NETWORK_ERROR')
  })

  it('should parse HTTP-date Retry-After as a non-negative delay', () => {
    const later = new Date(Date.now() + 5_000).toUTCString()
    const ms = parseRetryAfterMs(later)
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThan(10_000)
  })

  it('should keep the provider error code on the instance', () => {
    const error = new AiProviderError('TIMEOUT', 'stopped')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('TIMEOUT')
  })
})
