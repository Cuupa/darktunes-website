import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getEditorNotifications,
  getEditorUnreadCount,
  markEditorNotificationRead,
  markAllEditorNotificationsRead,
} from '@/lib/api/editorNotifications'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null, count: number | null = null) {
  const result = count !== null ? { data, error, count } : { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(
  data: unknown = null,
  error: unknown = null,
  count: number | null = null,
): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error, count)) } as unknown as DbClient
}

const row = {
  id: 'notif-1',
  recipient_id: 'user-1',
  type: 'artist_portal_message',
  entity_type: 'portal_message',
  entity_id: 'msg-1',
  entity_name: 'Artist message',
  sender_id: 'sender-1',
  read: false,
  created_at: '2026-07-02T10:00:00Z',
}

describe('editorNotifications DAL', () => {
  it('gets editor notifications', async () => {
    const db = makeMockDb([row])
    const items = await getEditorNotifications(db, 'user-1')
    expect(items[0].entityName).toBe('Artist message')
    expect(items[0].read).toBe(false)
  })

  it('gets unread count', async () => {
    const db = makeMockDb(null, null, 3)
    const count = await getEditorUnreadCount(db, 'user-1')
    expect(count).toBe(3)
  })

  it('marks one notification read', async () => {
    const db = makeMockDb(null)
    await markEditorNotificationRead(db, 'notif-1')
    expect(db.from).toHaveBeenCalledWith('editor_notifications')
  })

  it('marks all notifications read', async () => {
    const db = makeMockDb(null)
    await markAllEditorNotificationsRead(db, 'user-1')
    expect(db.from).toHaveBeenCalledWith('editor_notifications')
  })
})