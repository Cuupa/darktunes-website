import { describe, expect, it, vi } from 'vitest'
import { getEpkDownloadStats, logEpkDownloadEvent } from './epkDownloadEvents'

function createInsertMockDb(insertError: { message: string } | null = null) {
  const insertPayload = vi.fn()
  const builder = {
    insert: insertPayload,
    then: (resolve: (value: { error: typeof insertError }) => void) =>
      Promise.resolve({ error: insertError }).then(resolve),
    catch: (reject: (reason: unknown) => void) =>
      Promise.resolve({ error: insertError }).catch(reject),
    finally: (cb: () => void) => Promise.resolve({ error: insertError }).finally(cb),
  }
  insertPayload.mockReturnValue(builder)

  return { from: vi.fn(() => builder), insertPayload }
}

function createCountMockDb(counts: number[]) {
  let callIndex = 0
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    then: (resolve: (value: { count: number; error: null }) => void) => {
      const count = counts[callIndex] ?? 0
      callIndex += 1
      return Promise.resolve({ count, error: null }).then(resolve)
    },
    catch: (reject: (reason: unknown) => void) =>
      Promise.resolve({ count: 0, error: null }).catch(reject),
    finally: (cb: () => void) => Promise.resolve({ count: 0, error: null }).finally(cb),
  }

  return { from: vi.fn(() => builder), builder }
}

describe('epkDownloadEvents', () => {
  it('logs a download event', async () => {
    const mock = createInsertMockDb()
    await logEpkDownloadEvent(mock as never, {
      artistId: 'artist-1',
      source: 'portal',
      ipHash: 'abc',
    })
    expect(mock.insertPayload).toHaveBeenCalledWith({
      artist_id: 'artist-1',
      source: 'portal',
      share_link_id: null,
      ip_hash: 'abc',
      user_agent: null,
    })
  })

  it('aggregates download stats via count queries', async () => {
    const mock = createCountMockDb([10, 4, 6, 3, 1])
    const stats = await getEpkDownloadStats(mock as never, 'artist-1')
    expect(stats.total).toBe(10)
    expect(stats.last30Days).toBe(4)
    expect(stats.bySource.portal).toBe(6)
    expect(stats.bySource.share).toBe(3)
    expect(stats.bySource.press).toBe(1)
  })
})