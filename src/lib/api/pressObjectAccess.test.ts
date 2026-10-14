import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { authorizePressObject, recordPromoNdaAcceptance } from './pressObjectAccess'
import { mintPromoNdaToken } from '@/lib/press/promoNdaToken'

type Db = SupabaseClient<Database>

function mockDb(opts: {
  promo?: { r2_key: string; embargo_until: string | null; nda_required: boolean } | null
  asset?: { id: string; r2_key: string; public_url?: string } | null
  assetUrl?: { id: string; r2_key: string; public_url: string } | null
  preview?: { id: string; preview_url: string } | null
  cover?: { id: string; cover_art: string } | null
  ownedRelease?: { id: string; preview_url: string | null; cover_art: string | null } | null
  insertError?: string | null
  priorDownload?: boolean
}) {
  const inserts: unknown[] = []
  const from = vi.fn((table: string) => {
    const filters: Record<string, unknown> = {}
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value
        return builder
      }),
      insert: vi.fn((row: unknown) => {
        inserts.push(row)
        return builder
      }),
      maybeSingle: vi.fn(async () => {
        if (table === 'promo_tracks') {
          const hit = opts.promo && opts.promo.r2_key === filters.r2_key ? opts.promo : null
          return { data: hit, error: null }
        }
        if (table === 'assets' && filters.r2_key !== undefined) {
          const hit = opts.asset && opts.asset.r2_key === filters.r2_key ? opts.asset : null
          return { data: hit, error: null }
        }
        if (table === 'assets' && filters.public_url !== undefined) {
          const hit = opts.assetUrl && opts.assetUrl.public_url === filters.public_url ? opts.assetUrl : null
          return { data: hit, error: null }
        }
        if (table === 'releases' && filters.id !== undefined) {
          const hit = opts.ownedRelease && opts.ownedRelease.id === filters.id ? opts.ownedRelease : null
          return { data: hit, error: null }
        }
        if (table === 'releases' && filters.preview_url !== undefined) {
          const hit = opts.preview && opts.preview.preview_url === filters.preview_url ? opts.preview : null
          return { data: hit, error: null }
        }
        if (table === 'releases' && filters.cover_art !== undefined) {
          const hit = opts.cover && opts.cover.cover_art === filters.cover_art ? opts.cover : null
          return { data: hit, error: null }
        }
        return { data: null, error: null }
      }),
      limit: vi.fn(async () => {
        if (table === 'journalist_downloads') {
          return { data: opts.priorDownload ? [{ id: 'log-1' }] : [], error: null }
        }
        if (table === 'assets' && filters.public_url !== undefined) {
          const hit = opts.assetUrl && opts.assetUrl.public_url === filters.public_url ? opts.assetUrl : null
          return { data: hit ? [hit] : [], error: null }
        }
        if (table === 'releases' && filters.preview_url !== undefined) {
          const hit = opts.preview && opts.preview.preview_url === filters.preview_url ? opts.preview : null
          return { data: hit ? [hit] : [], error: null }
        }
        if (table === 'releases' && filters.cover_art !== undefined) {
          const hit = opts.cover && opts.cover.cover_art === filters.cover_art ? opts.cover : null
          return { data: hit ? [hit] : [], error: null }
        }
        return { data: [], error: null }
      }),
      single: vi.fn(async () => {
        if (opts.insertError) return { data: null, error: { message: opts.insertError } }
        return { data: { id: 'log-1' }, error: null }
      }),
    }
    return builder
  })
  return { db: { from } as unknown as Db, inserts }
}

const caller = { intent: 'download' as const, journalistId: 'journo-1', nowMs: Date.parse('2026-06-01T00:00:00Z') }

describe('authorizePressObject', () => {
  it('refuses a key that is not stored', async () => {
    const { db } = mockDb({})
    await expect(authorizePressObject(db, 'invoices/artist/invoice.pdf', caller)).resolves.toBeNull()
  })

  it('returns the stored promo key, not a lookalike caller string', async () => {
    const stored = 'promo/real-key.wav'
    const { db } = mockDb({
      promo: { r2_key: stored, embargo_until: null, nda_required: false },
    })
    const grant = await authorizePressObject(db, stored, { ...caller, intent: 'stream' })
    expect(grant?.stored).toBe(stored)
    expect(grant?.sign).toBe(true)
  })

  it('refuses a future embargo', async () => {
    const { db } = mockDb({
      promo: { r2_key: 'promo/soon.wav', embargo_until: '2026-12-01T00:00:00Z', nda_required: false },
    })
    await expect(authorizePressObject(db, 'promo/soon.wav', caller)).resolves.toBeNull()
  })

  it('refuses an NDA download without a server token, even if a download row exists', async () => {
    const secret = 'test-secret'
    const { db, inserts } = mockDb({
      promo: { r2_key: 'promo/nda.wav', embargo_until: null, nda_required: true },
      priorDownload: true,
    })
    await expect(authorizePressObject(db, 'promo/nda.wav', caller)).resolves.toBeNull()

    const token = mintPromoNdaToken(secret, 'journo-1', 'promo/nda.wav', caller.nowMs)
    const grant = await authorizePressObject(db, 'promo/nda.wav', {
      ...caller,
      ndaToken: token,
      ndaSecret: secret,
    })
    expect(grant?.stored).toBe('promo/nda.wav')
    expect(inserts).toHaveLength(0)

    const fresh = mockDb({
      promo: { r2_key: 'promo/nda.wav', embargo_until: null, nda_required: true },
    })
    const accepted = await recordPromoNdaAcceptance(fresh.db, 'promo/nda.wav', 'journo-1', caller.nowMs)
    expect(accepted).toBe(true)
    expect(fresh.inserts).toEqual([
      expect.objectContaining({ journalist_id: 'journo-1', asset_key: 'promo/nda.wav' }),
    ])
  })

  it('logs the release the caller named when covers are shared', async () => {
    const cover = 'https://cdn.example/shared.jpg'
    const { db } = mockDb({
      ownedRelease: { id: 'rel-b', preview_url: null, cover_art: cover },
      cover: { id: 'rel-a', cover_art: cover },
    })
    const grant = await authorizePressObject(db, cover, { ...caller, releaseId: 'rel-b' })
    expect(grant).toMatchObject({ stored: cover, sign: false, releaseId: 'rel-b' })
  })

  it('refuses a release id that does not own the file', async () => {
    const { db } = mockDb({
      ownedRelease: { id: 'rel-b', preview_url: null, cover_art: 'https://cdn.example/other.jpg' },
    })
    await expect(
      authorizePressObject(db, 'https://cdn.example/shared.jpg', { ...caller, releaseId: 'rel-b' }),
    ).resolves.toBeNull()
  })

  it('returns a stored https cover without signing it', async () => {
    const cover = 'https://cdn.example/cover.jpg'
    const { db } = mockDb({ cover: { id: 'rel-1', cover_art: cover } })
    const grant = await authorizePressObject(db, cover, caller)
    expect(grant).toMatchObject({ stored: cover, sign: false, releaseId: 'rel-1' })
  })

  it('allows a press-approved asset and ignores a random key', async () => {
    const { db } = mockDb({ asset: { id: 'asset-1', r2_key: 'press/photo.jpg' } })
    const grant = await authorizePressObject(db, 'press/photo.jpg', caller)
    expect(grant).toMatchObject({ stored: 'press/photo.jpg', assetId: 'asset-1', sign: true })
  })
})
