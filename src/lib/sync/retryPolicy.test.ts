import { describe, it, expect, vi } from 'vitest'
import { HttpError } from '@/lib/rateLimiter'
import {
  classifySyncError,
  isRateLimitedSyncError,
  isPermanentSyncError,
  withApiRetry,
} from './retryPolicy'

describe('classifySyncError', () => {
  it('classifies 429 as rate_limited', () => {
    expect(classifySyncError(new HttpError(429, 'too many'))).toBe('rate_limited')
  })

  it('classifies 404 as permanent', () => {
    expect(classifySyncError(new HttpError(404, 'missing'))).toBe('permanent')
  })

  it('classifies 502 as transient', () => {
    expect(classifySyncError(new HttpError(502, 'bad gateway'))).toBe('transient')
  })
})

describe('withApiRetry', () => {
  it('retries transient errors then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(502, 'bad gateway'))
      .mockResolvedValue('ok')

    const result = await withApiRetry('odesli', fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry permanent errors', async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError(404, 'missing'))
    await expect(withApiRetry('odesli', fn)).rejects.toThrow('missing')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('helpers', () => {
  it('detects rate limited strings', () => {
    expect(isRateLimitedSyncError(new HttpError(429, 'x'))).toBe(true)
    expect(isPermanentSyncError(new HttpError(422, 'x'))).toBe(true)
  })
})