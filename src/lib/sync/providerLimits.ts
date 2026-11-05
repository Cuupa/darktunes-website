/** Cross-instance provider rate limiting backed by an atomic Postgres slot. */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { HttpError } from '@/lib/rateLimiter'
import { sleepMs } from '@/lib/sync/queueExecutor'

type DbClient = SupabaseClient<Database>
export type SyncProvider = 'itunes' | 'spotify' | 'discogs' | 'songkick' | 'bandsintown'

/** Conservative starting values. Actual Spotify quota varies by app tier. */
export const PROVIDER_SPACING_MS: Record<SyncProvider, number> = {
  spotify: 3000,
  discogs: 1800,
  itunes: 800,
  songkick: 1800,
  bandsintown: 1800,
}

const FALLBACK_COOLDOWN_MS = 15 * 60 * 1000
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000
const MAX_INLINE_WAIT_MS = 8000

export function parseRetryAfterMs(value: string | null, nowMs = Date.now()): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Math.min(MAX_COOLDOWN_MS, Math.max(1000, Math.ceil(Number(trimmed) * 1000)))
  }
  const dateMs = Date.parse(trimmed)
  if (Number.isNaN(dateMs)) return null
  return Math.min(MAX_COOLDOWN_MS, Math.max(1000, dateMs - nowMs))
}

export class ProviderRateLimitedError extends HttpError {
  constructor(
    public readonly provider: SyncProvider,
    public readonly retryAfterMs: number,
  ) {
    super(429, `${provider} API rate limited; retry after ${Math.ceil(retryAfterMs / 1000)} seconds`)
    this.name = 'ProviderRateLimitedError'
  }
}

/**
 * Reserve a database-serialized slot before EVERY provider HTTP request.
 * Waits for short gaps; longer waits return to the queue instead of keeping
 * a Vercel function alive. A 429 blocks the provider for all artists/workers.
 */
export function createProviderFetch(
  db: DbClient,
  provider: SyncProvider,
  fetchImpl: typeof fetch,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const { data: wait, error } = await db.rpc('reserve_sync_provider_slot', {
      p_provider: provider,
      p_spacing_ms: PROVIDER_SPACING_MS[provider],
    })
    if (error || typeof wait !== 'number') {
      throw new Error(`Provider pacing unavailable for ${provider}: ${error?.message ?? 'invalid response'}`)
    }
    if (wait > MAX_INLINE_WAIT_MS) {
      throw new ProviderRateLimitedError(provider, wait)
    }
    if (wait > 0) await sleepMs(wait)

    const response = await fetchImpl(input, init)
    if (response.status === 429) {
      const cooldownMs = parseRetryAfterMs(response.headers?.get('retry-after') ?? null)
        ?? FALLBACK_COOLDOWN_MS
      const { error: blockError } = await db.rpc('block_sync_provider', {
        p_provider: provider,
        p_cooldown_ms: cooldownMs,
      })
      if (blockError) {
        throw new Error(`Could not activate ${provider} shared cooldown: ${blockError.message}`)
      }
      throw new ProviderRateLimitedError(provider, cooldownMs)
    }
    return response
  }) as typeof fetch
}
