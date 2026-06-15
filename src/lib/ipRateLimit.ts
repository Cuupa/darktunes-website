/**
 * src/lib/ipRateLimit.ts
 *
 * Simple in-memory sliding-window rate limiter for public API routes.
 *
 * Limitations:
 *   - In-memory: limits are per-instance, not shared across Vercel serverless
 *     pods. Use as a first line of defence only; pair with a Vercel WAF or
 *     Upstash Redis for stricter enforcement in production.
 *   - Not suitable for authenticated endpoints (use Supabase RLS + DAL there).
 *
 * Usage:
 *   const { limited } = checkRateLimit(getClientIp(request), 5, 10 * 60_000)
 *   if (limited) throw new ApiError(429, 'Too many requests')
 */

interface RateEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateEntry>()

// Prune expired entries every 5 minutes to prevent unbounded memory growth.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, 5 * 60_000)
}

/**
 * Check whether `ip` has exceeded `maxRequests` within the rolling `windowMs`.
 * Increments the counter on each call (regardless of the outcome).
 */
export function checkRateLimit(
  ip: string,
  maxRequests: number,
  windowMs: number,
): { limited: boolean } {
  const now = Date.now()
  const entry = store.get(ip)

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return { limited: false }
  }

  entry.count += 1
  return { limited: entry.count > maxRequests }
}

/**
 * Extract the client IP from standard Vercel / Cloudflare forwarding headers.
 * Falls back to `'unknown'` when no header is present (e.g., local dev).
 */
export function getClientIp(request: Request): string {
  return (
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
