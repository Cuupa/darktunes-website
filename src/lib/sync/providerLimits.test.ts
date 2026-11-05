import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createProviderFetch, parseRetryAfterMs, ProviderRateLimitedError } from './providerLimits'

function mockDb(waits: number[] = [0]) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'reserve_sync_provider_slot') {
      return { data: waits.shift() ?? 0, error: null }
    }
    return { data: null, error: null }
  })
  return { db: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

describe('shared API provider limiter', () => {
  it('parses HTTP retry-after seconds and dates and bounds them', () => {
    expect(parseRetryAfterMs('30')).toBe(30_000)
    expect(parseRetryAfterMs('1.5')).toBe(1_500)
    expect(parseRetryAfterMs('Tue, 10 Nov 2026 12:00:00 GMT', Date.parse('2026-11-10T11:59:00Z'))).toBe(60_000)
    expect(parseRetryAfterMs(null)).toBeNull()
    expect(parseRetryAfterMs('garbage')).toBeNull()
  })

  it('reserves a slot before each HTTP request', async () => {
    const { db, rpc } = mockDb([0, 0])
    const underlying = vi.fn().mockResolvedValue(new Response('{}'))
    const request = createProviderFetch(db, 'spotify', underlying)
    await request('https://api.spotify.com/v1/artists/x/albums')
    await request('https://api.spotify.com/v1/artists/x/albums?offset=10')
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledWith('reserve_sync_provider_slot', {
      p_provider: 'spotify',
      p_spacing_ms: 3000,
    })
    expect(underlying).toHaveBeenCalledTimes(2)
  })

  it('stops without an HTTP request when the provider has a longer cooldown', async () => {
    const { db } = mockDb([60_000])
    const underlying = vi.fn()
    await expect(createProviderFetch(db, 'spotify', underlying)('https://api.spotify.com')).rejects.toBeInstanceOf(ProviderRateLimitedError)
    expect(underlying).not.toHaveBeenCalled()
  })

  it('blocks all provider jobs after HTTP 429 and honors retry-after', async () => {
    const { db, rpc } = mockDb()
    const underlying = vi.fn().mockResolvedValue(new Response('Too many', {
      status: 429,
      headers: { 'Retry-After': '74' },
    }))
    await expect(createProviderFetch(db, 'spotify', underlying)('https://api.spotify.com')).rejects.toThrow('74 seconds')
    expect(rpc).toHaveBeenCalledWith('block_sync_provider', {
      p_provider: 'spotify',
      p_cooldown_ms: 74_000,
    })
  })

  it('fails closed when the database quota RPC is inaccessible', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    const underlying = vi.fn()
    const db = { rpc } as unknown as SupabaseClient<Database>
    await expect(createProviderFetch(db, 'itunes', underlying)('https://itunes.apple.com')).rejects.toThrow('pacing unavailable')
    expect(underlying).not.toHaveBeenCalled()
  })
})
