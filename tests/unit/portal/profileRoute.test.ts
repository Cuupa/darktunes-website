import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createServerSupabaseClientMock = vi.fn()
const resolvePortalArtistMock = vi.fn()
const upsertArtistProfileMock = vi.fn()
const revalidatePathMock = vi.fn()

const createBearerAuthSupabaseClientMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
  createBearerAuthSupabaseClient: createBearerAuthSupabaseClientMock,
}))

vi.mock('@/lib/api/artistProfiles', () => ({
  resolvePortalArtist: resolvePortalArtistMock,
  upsertArtistProfile: upsertArtistProfileMock,
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

    const supabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: fromMock,
    }

    createServerSupabaseClientMock.mockResolvedValue(supabaseClient)
    createBearerAuthSupabaseClientMock.mockResolvedValue(supabaseClient)

    resolvePortalArtistMock.mockResolvedValue({ id: artistId, slug: 'artist-slug' })
    upsertArtistProfileMock.mockResolvedValue({ id: 'profile-1' })
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

    expect(upsertArtistProfileMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        rider_stage_plot_url: null,
        rider_technical_url: null,
        rider_hospitality_url: null,
        epk_bg_image_url: null,
        custom_links: [{ label: 'Spotify', url: 'https://spotify.com/artist' }],
        epk_gallery_photos: ['https://images.example.com/gallery.jpg'],
      }),
    )

    const supabase = createServerSupabaseClientMock.mock.results[0]?.value
    const client = await supabase
    const updateBuilder = client.from.mock.results[0]?.value

    expect(client.from).toHaveBeenCalledWith('artists')
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
    expect(revalidatePathMock).toHaveBeenCalledWith('/artists/artist-slug')
    expect(revalidatePathMock).toHaveBeenCalledWith('/artists')
  })
})
