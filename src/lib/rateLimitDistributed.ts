/**
 * Distributed rate limiting with Upstash Redis REST when configured,
 * falling back to in-memory sliding window (per-instance).
 */

import { checkRateLimit } from '@/lib/ipRateLimit'

export type RateLimitResult = { limited: boolean; backend: 'upstash' | 'memory' }

let warnedFallback = false

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  )
}

/**
 * Fixed-window limit via Redis INCR + EXPIRE only on first hit (atomic Lua).
 *
 * EXPIRE must run only when INCR returns 1. Calling EXPIRE on every request
 * extends the window under continuous traffic so the counter never resets
 * until a full quiet period (trailing window) — wrong for a fixed window.
 */
async function checkUpstash(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const redisKey = `rl:${key}`
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000))

  // Atomic: INCR then EXPIRE only when this is the first hit in the window.
  const script = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
`.trim()

  const res = await fetch(`${base}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([['EVAL', script, '1', redisKey, String(windowSec)]]),
    signal: AbortSignal.timeout(3_000),
  })

  if (!res.ok) {
    throw new Error(`Upstash pipeline HTTP ${res.status}`)
  }

  const data = (await res.json()) as Array<{ result?: number | string }>
  const count = Number(data[0]?.result ?? 0)
  return { limited: count > maxRequests, backend: 'upstash' }
}

/**
 * Check rate limit. Uses Upstash when env is set; otherwise memory fallback.
 */
export async function checkDistributedRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (upstashConfigured()) {
    try {
      return await checkUpstash(key, maxRequests, windowMs)
    } catch (err) {
      if (!warnedFallback) {
        warnedFallback = true
        console.warn(
          '[rateLimitDistributed] Upstash failed; falling back to in-memory limit:',
          err instanceof Error ? err.message : err,
        )
      }
    }
  } else if (!warnedFallback && process.env.NODE_ENV === 'production') {
    warnedFallback = true
    console.warn(
      '[rateLimitDistributed] UPSTASH_REDIS_REST_* not set; using in-memory rate limits (per instance)',
    )
  }

  const { limited } = checkRateLimit(key, maxRequests, windowMs)
  return { limited, backend: 'memory' }
}
