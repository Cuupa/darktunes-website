import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getVideos, createVideo, updateVideo, deleteVideo } from './videos'

type DbClient = SupabaseClient<Database>
type VideoRow = Database['public']['Tables']['videos']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
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

const mockVideoRow: VideoRow = {
  id: 'vid-001',
  title: 'Monsters (Official Music Video)',
  artist_name: 'BLACKBOOK',
  youtube_id: 'Bx51eegLTY8',
  thumbnail_url: 'https://img.youtube.com/vi/Bx51eegLTY8/maxresdefault.jpg',
  published_at: '2024-04-24T00:00:00Z',
  created_at: '2024-04-24T00:00:00Z',
  updated_at: '2024-04-24T00:00:00Z',
}

describe('getVideos', () => {
  it('returns an empty array when there are no videos', async () => {
    const db = makeMockDb([])
    const result = await getVideos(db)
    expect(result).toEqual([])
  })

  it('maps rows to Video domain objects', async () => {
    const db = makeMockDb([mockVideoRow])
    const result = await getVideos(db)
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Monsters (Official Music Video)')
    expect(result[0].youtubeId).toBe('Bx51eegLTY8')
    expect(result[0].artistName).toBe('BLACKBOOK')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Query error', code: 'PGRST001' })
    await expect(getVideos(db)).rejects.toThrow('Query error')
  })
})

describe('createVideo', () => {
  it('returns the created Video', async () => {
    const db = makeMockDb(mockVideoRow)
    const result = await createVideo(db, {
      title: 'Monsters',
      artist_name: 'BLACKBOOK',
      youtube_id: 'Bx51eegLTY8',
    })
    expect(result.id).toBe('vid-001')
    expect(result.youtubeId).toBe('Bx51eegLTY8')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Duplicate youtube_id', code: '23505' })
    await expect(
      createVideo(db, { title: 'Test', artist_name: 'Artist', youtube_id: 'abc' }),
    ).rejects.toThrow('Duplicate youtube_id')
  })

  it('throws when no data returned', async () => {
    const db = makeMockDb(null)
    await expect(
      createVideo(db, { title: 'Test', artist_name: 'Artist', youtube_id: 'abc' }),
    ).rejects.toThrow('No data returned from createVideo')
  })
})

describe('updateVideo', () => {
  it('returns the updated Video', async () => {
    const updated = { ...mockVideoRow, title: 'Updated Title' }
    const db = makeMockDb(updated)
    const result = await updateVideo(db, 'vid-001', { title: 'Updated Title' })
    expect(result.title).toBe('Updated Title')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Update failed', code: 'PGRST001' })
    await expect(updateVideo(db, 'vid-001', { title: 'X' })).rejects.toThrow('Update failed')
  })
})

describe('deleteVideo', () => {
  it('resolves without error on success', async () => {
    const db = makeMockDb(null, null)
    await expect(deleteVideo(db, 'vid-001')).resolves.toBeUndefined()
  })

  it('throws when deletion fails', async () => {
    const db = makeMockDb(null, { message: 'Delete denied', code: 'PGRST301' })
    await expect(deleteVideo(db, 'vid-001')).rejects.toThrow('Delete denied')
  })
})
