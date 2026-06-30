import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getTracksBySubmissionId, createReleaseSubmissionTracks } from './releaseSubmissionTracks'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const row = {
  id: 'tr-1',
  submission_id: 'sub-1',
  track_number: 1,
  title: 'Song',
  isrc: 'DE-ABC-24-00001',
  composer: null,
  author: null,
  genre: null,
  language: null,
  gema: null,
  explicit: null,
  live: null,
  cover: null,
  instrumental: null,
  preview_start_seconds: null,
  duration_seconds: 180,
  form_data: null,
  display_order: 0,
  created_at: '2024-01-01T00:00:00Z',
}

describe('releaseSubmissionTracks DAL', () => {
  it('getTracksBySubmissionId maps rows', async () => {
    const db = makeMockDb([row])
    const tracks = await getTracksBySubmissionId(db, 'sub-1')
    expect(tracks).toHaveLength(1)
    expect(tracks[0].trackNumber).toBe(1)
    expect(tracks[0].durationSeconds).toBe(180)
  })

  it('createReleaseSubmissionTracks returns empty for no input', async () => {
    const db = makeMockDb([])
    const tracks = await createReleaseSubmissionTracks(db, [])
    expect(tracks).toHaveLength(0)
  })
})