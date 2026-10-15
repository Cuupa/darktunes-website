import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getRepliesForMessages, sendArtistReply } from './artistReplies'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
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
  id: 'reply-1',
  message_id: 'msg-1',
  artist_id: 'artist-1',
  body: 'Thanks!',
  body_html: null,
  deleted_at: null,
  sent_at: '2026-05-01T00:00:00Z',
}

describe('artistReplies DAL', () => {
  it('sends artist reply', async () => {
    const db = makeMockDb(row)
    const reply = await sendArtistReply(db, 'msg-1', 'artist-1', 'Thanks!')
    expect(reply.artistId).toBe('artist-1')
  })

  it('gets replies for many messages with a single query', async () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { ...row, id: 'reply-1', message_id: 'msg-1' },
          { ...row, id: 'reply-2', message_id: 'msg-1' },
          { ...row, id: 'reply-3', message_id: 'msg-2' },
        ],
        error: null,
      }),
    }
    const db = { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient

    const byMessage = await getRepliesForMessages(db, ['msg-1', 'msg-2'])

    expect(byMessage['msg-1']).toHaveLength(2)
    expect(byMessage['msg-2']).toHaveLength(1)
    expect(builder.in).toHaveBeenCalledTimes(1)
  })
})
