import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { buildEpkFontPublicUrl, listEpkFonts } from './epkFonts'

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): SupabaseClient<Database> {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as SupabaseClient<Database>
}

describe('epkFonts DAL', () => {
  it('builds public URL from r2 key', () => {
    expect(buildEpkFontPublicUrl('epk-fonts/a/font.woff2', 'https://cdn.example.com'))
      .toBe('https://cdn.example.com/epk-fonts/a/font.woff2')
  })

  it('lists artist and global fonts', async () => {
    const row = {
      id: 'font-1',
      artist_id: 'artist-1',
      name: 'Band Sans',
      r2_key: 'epk-fonts/artist-1/a.woff2',
      mime_type: 'font/woff2',
      created_at: '2026-01-01T00:00:00Z',
    }
    const db = makeMockDb([row])
    const fonts = await listEpkFonts(db, 'artist-1')
    expect(fonts[0]?.name).toBe('Band Sans')
  })
})