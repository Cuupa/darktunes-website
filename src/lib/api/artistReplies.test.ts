import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getRepliesForMessage, sendArtistReply } from './artistReplies'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
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
  id: 'reply-1',
  message_id: 'msg-1',
  artist_id: 'artist-1',
  body: 'Thanks!',
  sent_at: '2026-05-01T00:00:00Z',
}

describe('artistReplies DAL', () => {
  it('gets replies for message', async () => {
    const db = makeMockDb([row])
    const items = await getRepliesForMessage(db, 'msg-1')
    expect(items[0].messageId).toBe('msg-1')
  })

  it('sends artist reply', async () => {
    const db = makeMockDb(row)
    const reply = await sendArtistReply(db, 'msg-1', 'artist-1', 'Thanks!')
    expect(reply.artistId).toBe('artist-1')
  })
})
