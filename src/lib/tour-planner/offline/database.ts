import Dexie, { type Table } from 'dexie'

export interface QueuedMutation {
  id?: number
  artistId: string
  path: string
  method: string
  body: string | null
  createdAt: number
}

export interface OfflineMeta {
  key: string
  value: string
}

export class TourPlannerOfflineDb extends Dexie {
  syncQueue!: Table<QueuedMutation, number>
  meta!: Table<OfflineMeta, string>

  constructor() {
    super('darktunes-tour-planner')
    this.version(1).stores({
      syncQueue: '++id, artistId, createdAt',
      meta: 'key',
    })
  }
}

let db: TourPlannerOfflineDb | null = null

export function getTourPlannerDb(): TourPlannerOfflineDb {
  if (typeof window === 'undefined') {
    throw new Error('Tour planner offline DB is browser-only')
  }
  if (!db) db = new TourPlannerOfflineDb()
  return db
}