import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  createInterviewRequest,
  getInterviewRequestsByArtistId,
  getInterviewRequestsByJournalistId,
  updateInterviewRequest,
} from './interviewRequests'

type DbClient = SupabaseClient<Database>
type InterviewRequestRow = Database['public']['Tables']['interview_requests']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const row: InterviewRequestRow = {
  id: '11111111-1111-1111-1111-111111111111',
  journalist_id: 'journalist-1',
  artist_id: 'artist-1',
  subject: 'Interview',
  message: 'Please join.',
  preferred_date: '2026-07-01',
  status: 'pending',
  artist_reply: null,
  created_at: '2026-01-01T00:00:00Z',
}

describe('createInterviewRequest', () => {
  it('creates interview request', async () => {
    const db = makeMockDb(row)
    const result = await createInterviewRequest(db, {
      journalist_id: 'journalist-1',
      artist_id: 'artist-1',
      subject: 'Interview',
      message: 'Please join.',
    })
    expect(result.id).toBe(row.id)
  })
})

describe('getInterviewRequestsByJournalistId', () => {
  it('returns mapped requests', async () => {
    const db = makeMockDb([row])
    const result = await getInterviewRequestsByJournalistId(db, 'journalist-1')
    expect(result).toHaveLength(1)
    expect(result[0].journalistId).toBe('journalist-1')
  })
})

describe('getInterviewRequestsByArtistId', () => {
  it('returns mapped requests', async () => {
    const db = makeMockDb([row])
    const result = await getInterviewRequestsByArtistId(db, 'artist-1')
    expect(result).toHaveLength(1)
    expect(result[0].artistId).toBe('artist-1')
  })
})

describe('updateInterviewRequest', () => {
  it('updates request', async () => {
    const db = makeMockDb({ ...row, status: 'accepted', artist_reply: 'Yes' })
    const result = await updateInterviewRequest(db, row.id, { status: 'accepted', artist_reply: 'Yes' })
    expect(result.status).toBe('accepted')
    expect(result.artistReply).toBe('Yes')
  })
})
