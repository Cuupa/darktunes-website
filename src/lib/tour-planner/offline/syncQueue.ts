import { getTourPlannerDb } from '@/lib/tour-planner/offline/database'
import { tourPlannerFetchDirect } from '@/lib/tour-planner/clientApi'

const LAST_SYNC_KEY = 'lastSyncedAt'
const PENDING_COUNT_KEY = 'pendingCount'
const CONFLICT_COUNT_KEY = 'conflictCount'

export async function enqueueMutation(
  artistId: string,
  path: string,
  method: string,
  body: string | null,
): Promise<void> {
  const database = getTourPlannerDb()
  await database.syncQueue.add({ artistId, path, method, body, createdAt: Date.now() })
  const count = await database.syncQueue.count()
  await database.meta.put({ key: PENDING_COUNT_KEY, value: String(count) })
}

export async function getPendingMutationCount(): Promise<number> {
  return getTourPlannerDb().syncQueue.count()
}

export async function getSyncConflictCount(): Promise<number> {
  const row = await getTourPlannerDb().meta.get(CONFLICT_COUNT_KEY)
  return row?.value ? Number(row.value) : 0
}

export async function clearSyncConflictCount(): Promise<void> {
  await getTourPlannerDb().meta.put({ key: CONFLICT_COUNT_KEY, value: '0' })
}

export async function getLastSyncedAt(): Promise<string | null> {
  const row = await getTourPlannerDb().meta.get(LAST_SYNC_KEY)
  return row?.value ?? null
}

async function setLastSyncedAt(iso: string): Promise<void> {
  await getTourPlannerDb().meta.put({ key: LAST_SYNC_KEY, value: iso })
  await getTourPlannerDb().meta.put({ key: PENDING_COUNT_KEY, value: '0' })
}

async function incrementConflictCount(): Promise<void> {
  const current = await getSyncConflictCount()
  await getTourPlannerDb().meta.put({ key: CONFLICT_COUNT_KEY, value: String(current + 1) })
}

export async function flushSyncQueue(): Promise<{ flushed: number; failed: number; conflicts: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, failed: 0, conflicts: 0 }
  }

  const database = getTourPlannerDb()
  const pending = await database.syncQueue.orderBy('createdAt').toArray()
  let flushed = 0
  let failed = 0
  let conflicts = 0

  for (const item of pending) {
    if (!item.id) continue
    try {
      const res = await tourPlannerFetchDirect(item.artistId, item.path, {
        method: item.method,
        body: item.body ?? undefined,
      })
      if (res.status === 409) {
        await database.syncQueue.delete(item.id)
        await incrementConflictCount()
        conflicts += 1
        continue
      }
      if (!res.ok) {
        failed += 1
        continue
      }
      await database.syncQueue.delete(item.id)
      flushed += 1
    } catch {
      failed += 1
      continue
    }
  }

  if (flushed > 0) {
    await setLastSyncedAt(new Date().toISOString())
  }

  const count = await database.syncQueue.count()
  await database.meta.put({ key: PENDING_COUNT_KEY, value: String(count) })
  return { flushed, failed, conflicts }
}