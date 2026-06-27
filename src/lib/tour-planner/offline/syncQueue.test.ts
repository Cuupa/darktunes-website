import { describe, expect, it, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'

describe('syncQueue', () => {
  beforeAll(async () => {
    const { getTourPlannerDb } = await import('@/lib/tour-planner/offline/database')
    await getTourPlannerDb().syncQueue.clear()
  })

  it('enqueues and counts pending mutations', async () => {
    const { enqueueMutation, getPendingMutationCount } = await import('@/lib/tour-planner/offline/syncQueue')
    await enqueueMutation('artist-1', '/stops/abc', 'PATCH', '{"showStatus":"confirmed"}')
    expect(await getPendingMutationCount()).toBeGreaterThanOrEqual(1)
  })
})