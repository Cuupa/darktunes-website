import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createServiceRoleSupabaseClientMock = vi.fn()
const resolvePortalArtistMock = vi.fn()
const upsertArtistProfileMock = vi.fn()
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
  const artistId = '123e4567-e89b-12d3-a456-426614174000'

  beforeEach(() => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ update: updateMock }))

    const bearerClient = { from: vi.fn() }
    const serviceClient = { from: fromMock }

    authenticatePortalBearerMock.mockResolvedValue({
      token: 'tok',
      user: { id: 'user-1' },
      supabase: bearerClient,
    })
    createServiceRoleSupabaseClientMock.mockResolvedValue(serviceClient)

    resolvePortalArtistMock.mockResolvedValue({ id: artistId, slug: 'artist-slug' })
    upsertArtistProfileMock.mockResolvedValue({ id: 'profile-1' })
    syncPortalGalleryToPressKitMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
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

    // EPK upsert must use service-role (not the bearer/RLS client)
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
    // Never forward the raw password field to PostgREST
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

  it('persists hometown on artists via service-role after membership check', async () => {
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

    const serviceClient = await createServiceRoleSupabaseClientMock.mock.results[0]?.value
    expect(upsertArtistProfileMock).toHaveBeenCalledWith(
      serviceClient,
      expect.objectContaining({ artist_id: artistId }),
    )

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
        hometown: 'Leipzig',
      }),
    })

    const response = await PUT(request)
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body.code).toBe('SERVER_ERROR')
  })
})
