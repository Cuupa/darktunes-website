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

  it('uses atomic EVAL that only EXPIRE on first INCR (fixed window)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')

    let hit = 0
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      hit += 1
      const body = JSON.parse(String(init?.body ?? '[]')) as unknown[][]
      expect(body[0]?.[0]).toBe('EVAL')
      const script = String(body[0]?.[1] ?? '')
      expect(script).toContain("redis.call('INCR'")
      expect(script).toContain("if c == 1 then")
      expect(script).toContain("redis.call('EXPIRE'")
      expect(body[0]?.[2]).toBe('1')
      expect(body[0]?.[3]).toMatch(/^rl:/)
      expect(body[0]?.[4]).toBe('60')
      return {
        ok: true,
        json: async () => [{ result: hit }],
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const key = `test-upstash-${Date.now()}`
    const a = await checkDistributedRateLimit(key, 5, 60_000)
    const b = await checkDistributedRateLimit(key, 5, 60_000)

    expect(a.backend).toBe('upstash')
    expect(a.limited).toBe(false)
    expect(b.limited).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
