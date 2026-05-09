import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSiteSettings, upsertSiteSetting, upsertSiteSettings } from './siteSettings'

type DbClient = SupabaseClient<Database>

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

const mockRows = [
  { key: 'label_name', value: 'Test Label' },
  { key: 'label_tagline', value: 'Test tagline.' },
  { key: 'contact_email', value: 'test@example.com' },
  { key: 'privacy_policy_url', value: 'https://example.com/privacy' },
  { key: 'terms_url', value: 'https://example.com/terms' },
  { key: 'instagram_url', value: 'https://instagram.com/test' },
  { key: 'youtube_url', value: 'https://youtube.com/@test' },
  { key: 'spotify_url', value: 'https://open.spotify.com/user/test' },
  { key: 'spotify_playlist_uri', value: 'abc123' },
  { key: 'hero_badge', value: '🎵 New' },
  { key: 'hero_description', value: 'A test description.' },
  { key: 'seo_title', value: 'Test SEO Title' },
  { key: 'seo_description', value: 'Test SEO description.' },
  { key: 'og_title', value: 'Test OG Title' },
  { key: 'og_description', value: 'Test OG description.' },
]

describe('getSiteSettings', () => {
  it('maps all rows to the SiteSettings domain object', async () => {
    const db = makeMockDb(mockRows)
    const result = await getSiteSettings(db)
    expect(result.labelName).toBe('Test Label')
    expect(result.labelTagline).toBe('Test tagline.')
    expect(result.contactEmail).toBe('test@example.com')
    expect(result.instagramUrl).toBe('https://instagram.com/test')
    expect(result.spotifyPlaylistUri).toBe('abc123')
    expect(result.heroBadge).toBe('🎵 New')
    expect(result.seoTitle).toBe('Test SEO Title')
  })

  it('returns defaults when rows are empty', async () => {
    const db = makeMockDb([])
    const result = await getSiteSettings(db)
    expect(result.labelName).toBe('darkTunes Music Group')
    expect(result.spotifyPlaylistUri).toBe('37i9dQZF1DWWqNV5cS50j6')
    expect(result.instagramUrl).toBe('https://instagram.com/darktunes')
  })

  it('returns defaults for missing keys', async () => {
    const db = makeMockDb([{ key: 'label_name', value: 'Partial Label' }])
    const result = await getSiteSettings(db)
    expect(result.labelName).toBe('Partial Label')
    expect(result.contactEmail).toBe('info@darktunes.com')
    expect(result.youtubeUrl).toBe('https://youtube.com/@darktunes')
  })

  it('maps impressum fields from rows', async () => {
    const db = makeMockDb([
      ...mockRows,
      { key: 'impressum_company_name', value: 'Test GmbH' },
      { key: 'impressum_legal_form', value: 'GmbH' },
      { key: 'impressum_representative', value: 'Max Mustermann' },
      { key: 'impressum_address', value: 'Musterstraße 1\n12345 Berlin' },
      { key: 'impressum_vat_id', value: 'DE123456789' },
      { key: 'impressum_register_court', value: 'Amtsgericht Berlin' },
      { key: 'impressum_register_number', value: 'HRB 12345' },
      { key: 'impressum_phone', value: '+49 30 123456' },
      { key: 'impressum_email', value: 'legal@test.com' },
      { key: 'datenschutz_content', value: '## Privacy\nContent here.' },
      { key: 'consent_placeholder_url', value: 'https://cdn.example.com/placeholder.jpg' },
    ])
    const result = await getSiteSettings(db)
    expect(result.impressumCompanyName).toBe('Test GmbH')
    expect(result.impressumLegalForm).toBe('GmbH')
    expect(result.impressumRepresentative).toBe('Max Mustermann')
    expect(result.impressumVatId).toBe('DE123456789')
    expect(result.datenschutzContent).toBe('## Privacy\nContent here.')
    expect(result.consentPlaceholderUrl).toBe('https://cdn.example.com/placeholder.jpg')
  })

  it('returns empty string defaults for new legal fields when not in DB', async () => {
    const db = makeMockDb([])
    const result = await getSiteSettings(db)
    expect(result.impressumCompanyName).toBe('darkTunes Music Group')
    expect(result.impressumLegalForm).toBe('')
    expect(result.impressumVatId).toBe('')
    expect(result.datenschutzContent).toBe('')
    expect(result.consentPlaceholderUrl).toBe('')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Query failed', code: 'PGRST001' })
    await expect(getSiteSettings(db)).rejects.toThrow('Query failed')
  })
})

describe('upsertSiteSetting', () => {
  it('resolves without error on success', async () => {
    const db = makeMockDb(null, null)
    await expect(upsertSiteSetting(db, 'label_name', 'New Name')).resolves.toBeUndefined()
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Upsert failed', code: 'PGRST001' })
    await expect(upsertSiteSetting(db, 'label_name', 'X')).rejects.toThrow('Upsert failed')
  })
})

describe('upsertSiteSettings', () => {
  it('resolves without error when given multiple settings', async () => {
    const db = makeMockDb(null, null)
    await expect(
      upsertSiteSettings(db, { label_name: 'A', contact_email: 'a@b.com' }),
    ).resolves.toBeUndefined()
  })

  it('resolves immediately when given empty object', async () => {
    const db = makeMockDb(null, null)
    await expect(upsertSiteSettings(db, {})).resolves.toBeUndefined()
    // from() should NOT be called because there are no rows to upsert
    expect((db.from as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0)
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Batch upsert failed', code: 'PGRST001' })
    await expect(upsertSiteSettings(db, { label_name: 'X' })).rejects.toThrow('Batch upsert failed')
  })
})
