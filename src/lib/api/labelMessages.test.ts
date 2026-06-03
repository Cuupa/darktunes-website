import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getLabelMessages, sendMessage, markMessageRead } from './labelMessages'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const row = {
  id: 'msg-1',
  artist_id: 'artist-1',
  subject: 'Subject',
  body: 'Body',
  body_html: null,
  read: false,
  read_at: null,
  starred: false,
  deleted_at: null,
  sent_at: '2026-01-01T00:00:00Z',
}

describe('labelMessages DAL', () => {
  it('gets artist messages', async () => {
    const db = makeMockDb([row])
    const items = await getLabelMessages(db, 'artist-1')
    expect(items[0].subject).toBe('Subject')
  })

  it('sends message', async () => {
    const db = makeMockDb(row)
    const msg = await sendMessage(db, 'artist-1', 'Subject', 'Body')
    expect(msg.artistId).toBe('artist-1')
  })

  it('marks read', async () => {
    const db = makeMockDb({ ...row, read: true })
    const msg = await markMessageRead(db, 'msg-1')
    expect(msg.read).toBe(true)
  })
})
