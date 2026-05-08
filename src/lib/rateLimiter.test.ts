import { describe, it, expect, vi } from 'vitest'
import { HttpError, isRetryable, withExponentialBackoff } from './rateLimiter'

describe('HttpError', () => {
  it('is an instance of Error', () => {
    const err = new HttpError(429, 'Too Many Requests')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('HttpError')
    expect(err.status).toBe(429)
    expect(err.message).toBe('Too Many Requests')
  })
})

describe('isRetryable', () => {
  it('returns true for HTTP 429', () => {
    expect(isRetryable(new HttpError(429, 'rate limited'))).toBe(true)
  })

  it('returns true for HTTP 500', () => {
    expect(isRetryable(new HttpError(500, 'server error'))).toBe(true)
  })

  it('returns true for HTTP 503', () => {
    expect(isRetryable(new HttpError(503, 'service unavailable'))).toBe(true)
  })

  it('returns false for HTTP 400', () => {
    expect(isRetryable(new HttpError(400, 'bad request'))).toBe(false)
  })

  it('returns false for HTTP 404', () => {
    expect(isRetryable(new HttpError(404, 'not found'))).toBe(false)
  })

  it('returns false for non-HttpError', () => {
    expect(isRetryable(new Error('network error'))).toBe(false)
    expect(isRetryable('string error')).toBe(false)
    expect(isRetryable(null)).toBe(false)
  })
})

describe('withExponentialBackoff', () => {
  it('returns the resolved value on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withExponentialBackoff(fn, 3, 0)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(429, 'rate limited'))
      .mockResolvedValue('ok')
    const result = await withExponentialBackoff(fn, 3, 0)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws immediately for non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(404, 'not found'))
    await expect(withExponentialBackoff(fn, 3, 0)).rejects.toThrow('not found')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(500, 'server error'))
    await expect(withExponentialBackoff(fn, 2, 0)).rejects.toThrow('server error')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('throws immediately for non-HttpError without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('parse error'))
    await expect(withExponentialBackoff(fn, 3, 0)).rejects.toThrow('parse error')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
