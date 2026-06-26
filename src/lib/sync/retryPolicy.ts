/**
 * Per-API retry policies for external sync calls.
 * Classifies errors and applies backoff with jitter for transient failures.
 */

import { HttpError } from '@/lib/rateLimiter'

export type SyncApiName = 'itunes' | 'spotify' | 'discogs' | 'songkick' | 'bandsintown' | 'odesli'

export type SyncErrorClass = 'permanent' | 'transient' | 'rate_limited'

export interface ApiRetryProfile {
  maxRetries: number
  baseDelayMs: number
  jitter: boolean
}

export const API_RETRY_PROFILES: Record<SyncApiName, ApiRetryProfile> = {
  itunes: { maxRetries: 3, baseDelayMs: 500, jitter: false },
  spotify: { maxRetries: 4, baseDelayMs: 1000, jitter: true },
  discogs: { maxRetries: 3, baseDelayMs: 1000, jitter: true },
  songkick: { maxRetries: 3, baseDelayMs: 1000, jitter: true },
  bandsintown: { maxRetries: 3, baseDelayMs: 1000, jitter: true },
  odesli: { maxRetries: 5, baseDelayMs: 2000, jitter: true },
}

/** Cooldown before re-queueing a job that hit rate limits (ms). */
export const RATE_LIMIT_JOB_COOLDOWN_MS = 15 * 60 * 1000

export function classifySyncError(err: unknown): SyncErrorClass {
  if (err instanceof HttpError) {
    if (err.status === 429) return 'rate_limited'
    if (err.status >= 500) return 'transient'
    if (err.status === 404 || err.status === 405 || err.status === 422) return 'permanent'
    if (err.status >= 400) return 'permanent'
    return 'transient'
  }

  const msg = String(err)
  if (msg.includes('429') || msg.includes('TOO_MANY_REQUESTS')) return 'rate_limited'
  if (msg.includes('502') || msg.includes('503') || msg.includes('504')) return 'transient'
  if (
    msg.includes('404') ||
    msg.includes('405') ||
    msg.includes('422') ||
    msg.includes('UNSUPPORTED_URL') ||
    msg.includes('No match')
  ) {
    return 'permanent'
  }
  if (msg.includes('no unique or exclusion constraint')) return 'permanent'
  return 'transient'
}

export function isPermanentSyncError(err: unknown): boolean {
  return classifySyncError(err) === 'permanent'
}

export function isRateLimitedSyncError(err: unknown): boolean {
  return classifySyncError(err) === 'rate_limited'
}

function applyJitter(delayMs: number): number {
  const factor = 0.75 + Math.random() * 0.5
  return Math.round(delayMs * factor)
}

function delayWithProfile(baseDelayMs: number, attempt: number, jitter: boolean): number {
  const exponential = baseDelayMs * Math.pow(2, attempt)
  return jitter ? applyJitter(exponential) : exponential
}

/**
 * Executes `fn` with API-specific retry policy.
 * Non-retryable errors throw immediately.
 */
export async function withApiRetry<T>(api: SyncApiName, fn: () => Promise<T>): Promise<T> {
  const profile = API_RETRY_PROFILES[api]
  let lastErr: unknown

  for (let attempt = 0; attempt <= profile.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const errorClass = classifySyncError(err)
      if (errorClass === 'permanent' || attempt === profile.maxRetries) throw err
      const delay = delayWithProfile(profile.baseDelayMs, attempt, profile.jitter)
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastErr
}

