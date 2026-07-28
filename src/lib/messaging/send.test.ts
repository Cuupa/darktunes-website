import { describe, it, expect, vi } from 'vitest'
import { sendLabelMessage } from './send'

function mockDb(opts: {
  existing?: Record<string, unknown> | null
  inserted?: Record<string, unknown>
}) {
  const rulesBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }

  return {
    from(table: string) {
      if (table === 'message_rules') return rulesBuilder
      if (table === 'label_messages') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: opts.existing ?? null,
            error: null,
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: opts.inserted ?? {
                  id: 'new-1',
                  artist_id: 'a1',
                  subject: 'Hi',
                  body: 'Body',
                  body_html: null,
                  read: false,
                  read_at: null,
                  starred: false,
                  deleted_at: null,
                  sent_at: '2026-01-01T00:00:00Z',
                  folder_id: null,
                  sender_email: null,
                  is_external: false,
                  forwarded_from: null,
                  has_attachments: false,
                  sender_user_id: 'u1',
                  client_message_id: '11111111-1111-4111-8111-111111111111',
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnThis(),
        }
      }
      throw new Error(`unexpected ${table}`)
    },
  }
}

describe('sendLabelMessage', () => {
  it('returns existing row when clientMessageId already stored', async () => {
    const existing = {
      id: 'old-1',
      artist_id: 'a1',
      subject: 'Hi',
      body: 'Body',
      body_html: null,
      read: false,
      read_at: null,
      starred: false,
      deleted_at: null,
      sent_at: '2026-01-01T00:00:00Z',
      folder_id: null,
      sender_email: null,
      is_external: false,
      forwarded_from: null,
      has_attachments: false,
      sender_user_id: 'u1',
      client_message_id: '11111111-1111-4111-8111-111111111111',
    }
    const db = mockDb({ existing }) as never
    const result = await sendLabelMessage(db, {
      artistId: 'a1',
      subject: 'Hi',
      body: 'Body',
      clientMessageId: '11111111-1111-4111-8111-111111111111',
      senderUserId: 'u1',
    })
    expect(result.duplicate).toBe(true)
    expect(result.message.id).toBe('old-1')
  })

  it('inserts when no prior clientMessageId', async () => {
    const db = mockDb({ existing: null }) as never
    const result = await sendLabelMessage(db, {
      artistId: 'a1',
      subject: 'Hi',
      body: 'Body',
      senderUserId: 'u1',
    })
    expect(result.duplicate).toBe(false)
    expect(result.message.id).toBe('new-1')
  })
})
