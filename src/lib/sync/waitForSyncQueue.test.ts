import { describe, expect, it, vi } from 'vitest'
import { syncBacklogProgressPercent, waitForSyncQueueIdle } from './waitForSyncQueue'

describe('syncBacklogProgressPercent', () => {
  it('maps remaining backlog to percent without faking 100 until idle', () => {
    expect(syncBacklogProgressPercent(10, 10)).toBe(0)
    expect(syncBacklogProgressPercent(5, 10)).toBe(50)
    expect(syncBacklogProgressPercent(1, 10)).toBe(90)
    expect(syncBacklogProgressPercent(0, 10)).toBe(100)
  })
})

describe('waitForSyncQueueIdle', () => {
  it('returns drained immediately when queue is already idle', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pending: 0, running: 0, done: 1, failed: 0 }),
    })

    const result = await waitForSyncQueueIdle({
      accessToken: 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 10,
    })

    expect(result.drained).toBe(true)
    expect(result.waitedMs).toBe(0)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('kicks executor only when running is 0 and reports backlog progress', async () => {
    let polls = 0
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, text: async () => '{"accepted":true}' }
      }
      polls += 1
      if (polls === 1) {
        return {
          ok: true,
          json: async () => ({ pending: 2, running: 1, done: 0, failed: 0 }),
        }
      }
      if (polls === 2) {
        return {
          ok: true,
          json: async () => ({ pending: 1, running: 0, done: 2, failed: 0 }),
        }
      }
      return {
        ok: true,
        json: async () => ({ pending: 0, running: 0, done: 3, failed: 0 }),
      }
    })

    const progress: number[] = []
    const percents: number[] = []
    const result = await waitForSyncQueueIdle({
      accessToken: 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 5,
      timeoutMs: 5_000,
      onProgress: (active, _stats, percent) => {
        progress.push(active)
        if (typeof percent === 'number') percents.push(percent)
      },
    })

    expect(result.drained).toBe(true)
    expect(progress[0]).toBe(3)
    expect(progress.at(-1)).toBe(0)
    // First poll: running > 0 → no kick. Later: running === 0 && pending > 0 → kick.
    const postCalls = fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(postCalls.length).toBeGreaterThanOrEqual(1)
    expect(percents[0]).toBe(0)
    expect(percents.at(-1)).toBe(100)
  })

  it('returns drained false on timeout while jobs remain', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, text: async () => '{"accepted":true}' }
      }
      return {
        ok: true,
        json: async () => ({ pending: 5, running: 1, done: 0, failed: 0 }),
      }
    })

    const result = await waitForSyncQueueIdle({
      accessToken: 't',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      pollIntervalMs: 5,
      timeoutMs: 30,
    })

    expect(result.drained).toBe(false)
    expect(result.stats.pending).toBe(5)
    // running > 0 → never kick while a worker is active
    const postCalls = fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(postCalls).toHaveLength(0)
  })
})
