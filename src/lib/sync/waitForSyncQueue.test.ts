import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForSyncQueueIdle } from './waitForSyncQueue'

describe('waitForSyncQueueIdle', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns drained immediately when queue is already idle', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pending: 0, running: 0, done: 5, failed: 0 }),
    })

    const result = await waitForSyncQueueIdle({
      accessToken: 'token',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.drained).toBe(true)
    expect(result.waitedMs).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('polls, kicks executor, and drains when jobs finish', async () => {
    vi.useFakeTimers()

    const responses = [
      { pending: 2, running: 1, done: 0, failed: 0 },
      { pending: 1, running: 0, done: 2, failed: 0 },
      { pending: 0, running: 0, done: 3, failed: 0 },
    ]
    let call = 0
    const fetchImpl = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST' || String(url).endsWith('/api/sync')) {
        return { ok: true, text: async () => '{"accepted":true}' }
      }
      const body = responses[Math.min(call, responses.length - 1)]
      call++
      return { ok: true, json: async () => body }
    })

    const progress: number[] = []
    const promise = waitForSyncQueueIdle({
      accessToken: 'token',
      pollIntervalMs: 100,
      timeoutMs: 5_000,
      onProgress: (active) => {
        progress.push(active)
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await vi.advanceTimersByTimeAsync(250)
    const result = await promise

    expect(result.drained).toBe(true)
    expect(progress[0]).toBe(3)
    expect(progress.at(-1)).toBe(0)
    expect(fetchImpl).toHaveBeenCalled()
  })

  it('returns drained false on timeout while jobs remain', async () => {
    vi.useFakeTimers()

    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, text: async () => '{"accepted":true}' }
      }
      return {
        ok: true,
        json: async () => ({ pending: 5, running: 1, done: 0, failed: 0 }),
      }
    })

    const promise = waitForSyncQueueIdle({
      accessToken: 'token',
      pollIntervalMs: 50,
      timeoutMs: 120,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await vi.advanceTimersByTimeAsync(200)
    const result = await promise

    expect(result.drained).toBe(false)
    expect(result.stats.pending + result.stats.running).toBeGreaterThan(0)
  })
})
