import { describe, it, expect, afterEach, vi } from 'vitest'
import { checkDistributedRateLimit } from './rateLimitDistributed'

describe('checkDistributedRateLimit', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('falls back to memory when Upstash is not configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    const key = `test-memory-${Date.now()}`
    const a = await checkDistributedRateLimit(key, 2, 60_000)
    const b = await checkDistributedRateLimit(key, 2, 60_000)
    const c = await checkDistributedRateLimit(key, 2, 60_000)
    expect(a.backend).toBe('memory')
    expect(a.limited).toBe(false)
    expect(b.limited).toBe(false)
    expect(c.limited).toBe(true)
  })
})
