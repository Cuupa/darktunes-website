import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPressPhotos, createPressPhoto, deletePressPhoto } from './pressPhotos'

type DbClient = SupabaseClient<Database>
type PressPhotoRow = Database['public']['Tables']['press_photos']['Row']

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

const mockPhotoRow: PressPhotoRow = {
  id: 'photo-uuid-1',
  title: 'Band Live Shot',
  alt_text: 'The band performing live',
  r2_key: 'press-photos/photo-uuid-1.jpg',
  public_url: 'https://cdn.darktunes.com/press-photos/photo-uuid-1.jpg',
  display_order: 0,
  category: 'photo',
  artist_id: null,
  created_at: '2024-06-01T00:00:00Z',
}

describe('getPressPhotos', () => {
  it('returns empty array when no photos exist', async () => {
    const db = makeMockDb([])
    const result = await getPressPhotos(db)
    expect(result).toEqual([])
  })

  it('maps rows to PressPhoto domain objects', async () => {
    const db = makeMockDb([mockPhotoRow])
    const result = await getPressPhotos(db)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('photo-uuid-1')
    expect(result[0].title).toBe('Band Live Shot')
    expect(result[0].altText).toBe('The band performing live')
    expect(result[0].r2Key).toBe('press-photos/photo-uuid-1.jpg')
    expect(result[0].publicUrl).toBe('https://cdn.darktunes.com/press-photos/photo-uuid-1.jpg')
    expect(result[0].displayOrder).toBe(0)
    expect(result[0].category).toBe('photo')
    expect(result[0].artistId).toBeUndefined()
  })

  it('maps null alt_text to undefined', async () => {
    const rowWithoutAlt: PressPhotoRow = { ...mockPhotoRow, alt_text: null }
    const db = makeMockDb([rowWithoutAlt])
    const result = await getPressPhotos(db)
    expect(result[0].altText).toBeUndefined()
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'RLS violation', code: 'PGRST301' })
    await expect(getPressPhotos(db)).rejects.toThrow('RLS violation')
  })
})

describe('createPressPhoto', () => {
  it('inserts and returns the mapped domain object', async () => {
    const db = makeMockDb(mockPhotoRow)
    const result = await createPressPhoto(db, {
      title: 'Band Live Shot',
      r2_key: 'press-photos/photo-uuid-1.jpg',
      public_url: 'https://cdn.darktunes.com/press-photos/photo-uuid-1.jpg',
    })
    expect(result.id).toBe('photo-uuid-1')
    expect(result.title).toBe('Band Live Shot')
    expect(result.r2Key).toBe('press-photos/photo-uuid-1.jpg')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'duplicate key', code: '23505' })
    await expect(
      createPressPhoto(db, {
        title: 'Dup',
        r2_key: 'dup',
        public_url: 'https://cdn.darktunes.com/dup',
      }),
    ).rejects.toThrow('duplicate key')
  })

  it('throws when no row is returned', async () => {
    const db = makeMockDb(null, null)
    await expect(
      createPressPhoto(db, {
        title: 'Empty',
        r2_key: 'empty',
        public_url: 'https://cdn.darktunes.com/empty',
      }),
    ).rejects.toThrow('No data returned from createPressPhoto')
  })
})

describe('deletePressPhoto', () => {
  it('resolves without error on success', async () => {
    const db = makeMockDb(null, null)
    await expect(deletePressPhoto(db, 'photo-uuid-1')).resolves.toBeUndefined()
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'not found', code: 'PGRST116' })
    await expect(deletePressPhoto(db, 'missing-id')).rejects.toThrow('not found')
  })
})
