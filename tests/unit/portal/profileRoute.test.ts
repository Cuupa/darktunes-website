import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  TEST_ARTIST_ID,
  expectForbidden,
  expectOk,
  expectUnauthorized,
  jsonRequest,
  rejectApiError,
} from '../../helpers/api/routeTestkit'

const createServiceRoleSupabaseClientMock = vi.fn()
const resolvePortalArtistMock = vi.fn()
const upsertArtistProfileMock = vi.fn()
const getArtistProfileByArtistIdMock = vi.fn()
const syncPortalGalleryToPressKitMock = vi.fn()
const revalidatePathMock = vi.fn()
const authenticatePortalBearerMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleSupabaseClient: createServiceRoleSupabaseClientMock,
}))

vi.mock('@/lib/portal/bearerAuth', () => ({
  authenticatePortalBearer: authenticatePortalBearerMock,
}))

vi.mock('@/lib/api/artistProfiles', () => ({
  resolvePortalArtist: resolvePortalArtistMock,
  upsertArtistProfile: upsertArtistProfileMock,
  getArtistProfileByArtistId: getArtistProfileByArtistIdMock,
}))

vi.mock('@/lib/api/portalGalleryPress', () => ({
  syncPortalGalleryToPressKit: syncPortalGalleryToPressKitMock,
}))

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/profile/route')
}

describe('PUT /api/portal/profile', () => {
  const artistId = TEST_ARTIST_ID

  beforeEach(() => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ update: updateMock }))
    const serviceClient = { from: fromMock }

    authenticatePortalBearerMock.mockResolvedValue({
      token: 'tok',
      user: { id: 'user-1' },
      supabase: { from: vi.fn() },
    })
    createServiceRoleSupabaseClientMock.mockResolvedValue(serviceClient)

    resolvePortalArtistMock.mockResolvedValue({ id: artistId, slug: 'artist-slug' })
    upsertArtistProfileMock.mockResolvedValue({ id: 'profile-1' })
    getArtistProfileByArtistIdMock.mockResolvedValue({ id: 'profile-existing' })
    syncPortalGalleryToPressKitMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // --- Golden auth matrix (API SOTA Phase B3) ---

  it('golden: 401 without Bearer auth', async () => {
    authenticatePortalBearerMock.mockImplementation(() =>
      rejectApiError(401, 'Invalid or expired token'),
    )
    const { PUT } = await loadRoute()
    const res = await PUT(
      jsonRequest('/api/portal/profile', {
        method: 'PUT',
        body: { artist_id: artistId, hometown: 'Berlin' },
      }),
    )
    await expectUnauthorized(res)
  })

  it('golden: 403 when not a member of the artist', async () => {
    resolvePortalArtistMock.mockRejectedValue(new Error('FORBIDDEN: not a member of this artist'))
    const { PUT } = await loadRoute()
    const res = await PUT(
      jsonRequest('/api/portal/profile', {
        method: 'PUT',
        bearer: 'tok',
        body: { artist_id: artistId, hometown: 'Berlin' },
      }),
    )
    await expectForbidden(res)
  })

  it('golden: 200 when hometown-only patch succeeds', async () => {
    const { PUT } = await loadRoute()
    const res = await PUT(
      jsonRequest('/api/portal/profile', {
        method: 'PUT',
        bearer: 'tok',
        body: { artist_id: artistId, hometown: 'Berlin, Germany' },
      }),
    )
    await expectOk(res, 200)
    expect(upsertArtistProfileMock).not.toHaveBeenCalled()
  })

  it('accepts empty URL strings and normalises them to null', async () => {
    const { PUT } = await loadRoute()
    const request = new NextRequest('http://localhost/api/portal/profile', {
      method: 'PUT',
      headers: {
        authorization: '******',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artist_id: artistId,
        image_url: 'https://cdn.example.com/photo.jpg',
        website_url: '',
        instagram_url: '',
        youtube_url: '',
        bandcamp_url: '',
        spotify_url: '',
        apple_music_url: '',
        tiktok_url: '',
        facebook_url: 'https://facebook.com/example-artist',
        soundcloud_url: '',
        rider_stage_plot_url: '',
        rider_technical_url: '',
        rider_hospitality_url: '',
        epk_bg_image_url: '',
        custom_links: [
          { label: 'Main', url: '' },
          { label: 'Spotify', url: 'https://spotify.com/artist' },
        ],
        epk_gallery_photos: ['', 'https://images.example.com/gallery.jpg'],
      }),
    })

    const response = await PUT(request)
    const responseBody = await response.json()
    expect(response.status, responseBody.error).toBe(200)

    const serviceClient = await createServiceRoleSupabaseClientMock.mock.results[0]?.value

    expect(upsertArtistProfileMock).toHaveBeenCalledWith(
      serviceClient,
      expect.objectContaining({
        artist_id: artistId,
        rider_stage_plot_url: null,
        rider_technical_url: null,
        rider_hospitality_url: null,
        epk_bg_image_url: null,
        custom_links: [{ label: 'Spotify', url: 'https://spotify.com/artist' }],
        epk_gallery_photos: ['https://images.example.com/gallery.jpg'],
      }),
    )
    const upsertPayload = upsertArtistProfileMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(upsertPayload).not.toHaveProperty('epk_password_raw')

    const updateBuilder = serviceClient.from.mock.results[0]?.value

    expect(serviceClient.from).toHaveBeenCalledWith('artists')
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: 'https://cdn.example.com/photo.jpg',
        website_url: null,
        instagram_url: null,
        youtube_url: null,
        bandcamp_url: null,
        spotify_url: null,
        apple_music_url: null,
        tiktok_url: null,
        facebook_url: 'https://facebook.com/example-artist',
        soundcloud_url: null,
      }),
    )
    expect(syncPortalGalleryToPressKitMock).toHaveBeenCalledWith(
      expect.anything(),
      artistId,
      ['https://images.example.com/gallery.jpg'],
      'user-1',
    )
    expect(revalidatePathMock).toHaveBeenCalledWith('/artists/artist-slug')
    expect(revalidatePathMock).toHaveBeenCalledWith('/press/artists/artist-slug')
    expect(revalidatePathMock).toHaveBeenCalledWith('/artists')
  })

  it('persists hometown without artist_epks upsert when only roster fields change', async () => {
    const { PUT } = await loadRoute()
    const request = new NextRequest('http://localhost/api/portal/profile', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer tok',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artist_id: artistId,
        hometown: 'Berlin, Germany',
        founding_year: 2015,
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(200)

    // Partial roster-only patch must not upsert EPK
    expect(upsertArtistProfileMock).not.toHaveBeenCalled()
    expect(getArtistProfileByArtistIdMock).toHaveBeenCalled()

    const serviceClient = await createServiceRoleSupabaseClientMock.mock.results[0]?.value
    const updateBuilder = serviceClient.from.mock.results[0]?.value
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        hometown: 'Berlin, Germany',
        founding_year: 2015,
      }),
    )
  })

  it('accepts legacy relative image paths without failing validation', async () => {
    const { PUT } = await loadRoute()
    const request = new NextRequest('http://localhost/api/portal/profile', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer tok',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artist_id: artistId,
        image_url: 'profile-photos/artist/photo.jpg',
        hometown: 'Hamburg',
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(200)

    expect(upsertArtistProfileMock).not.toHaveBeenCalled()
    const serviceClient = await createServiceRoleSupabaseClientMock.mock.results[0]?.value
    const updateBuilder = serviceClient.from.mock.results[0]?.value
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: 'profile-photos/artist/photo.jpg',
        hometown: 'Hamburg',
      }),
    )
  })

  it('still returns 200 when gallery press sync fails', async () => {
    syncPortalGalleryToPressKitMock.mockRejectedValue(new Error('duplicate r2_key'))

    const { PUT } = await loadRoute()
    const request = new NextRequest('http://localhost/api/portal/profile', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer tok',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artist_id: artistId,
        epk_gallery_photos: ['https://images.example.com/gallery.jpg'],
      }),
    })

    const response = await PUT(request)
    expect(response.status).toBe(200)
    expect(upsertArtistProfileMock).toHaveBeenCalled()
  })

  it('returns 500 when artist_epks upsert fails', async () => {
    upsertArtistProfileMock.mockRejectedValue(new Error('new row violates row-level security policy'))

    const { PUT } = await loadRoute()
    const request = new NextRequest('http://localhost/api/portal/profile', {
      method: 'PUT',
      headers: {
        authorization: 'Bearer tok',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        artist_id: artistId,
        press_quote: 'Great band',
      }),
    })

    const response = await PUT(request)
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.code).toBe('SERVER_ERROR')
  })
})
