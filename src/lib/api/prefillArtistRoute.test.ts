import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

function mockSupabaseClient(opts: { role: 'admin' | 'editor' | 'user'; authError?: boolean }) {
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn(async () =>
          opts.authError
            ? { data: { user: null }, error: new Error('Unauthorized') }
            : { data: { user: { id: 'user-1' } }, error: null },
        ),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(async () => ({ data: { role: opts.role }, error: null })),
      })),
    })),
  }))
}

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/prefill-artist/route')
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('POST /api/admin/prefill-artist', () => {
  it('returns prefill payload for an admin token', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.API_CREDENTIALS_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

    mockSupabaseClient({ role: 'admin' })
    vi.doMock('@/lib/secrets/getExternalCredentials', () => ({
      getSyncCredentials: vi.fn(async () => ({
        spotify: { clientId: 'client-id', clientSecret: 'client-secret' },
      })),
    }))
    vi.doMock('@/lib/supabase/server', () => ({
      createServiceRoleSupabaseClient: vi.fn(async () => ({})),
    }))
    vi.doMock('@/lib/rateLimiter', async () => {
      const actual = await vi.importActual<typeof import('@/lib/rateLimiter')>('@/lib/rateLimiter')
      return {
        ...actual,
        withExponentialBackoff: vi.fn(async (fn: () => Promise<unknown>) => fn()),
      }
    })
    vi.doMock('@/lib/sync/spotifyApi', async () => {
      const actual = await vi.importActual<typeof import('@/lib/sync/spotifyApi')>('@/lib/sync/spotifyApi')
      return {
        ...actual,
        fetchSpotifyArtistProfile: vi.fn(async () => ({
          spotifyId: 'artist123',
          name: 'Dark Artist',
          imageUrl: 'https://i.scdn.co/image/artist.jpg',
          genres: ['industrial'],
          spotifyUrl: 'https://open.spotify.com/artist/artist123',
          popularity: 80,
        })),
      }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      new Request('http://localhost/api/admin/prefill-artist', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spotifyUrl: 'https://open.spotify.com/artist/artist123?si=abc' }),
      }) as never,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      spotifyId: 'artist123',
      name: 'Dark Artist',
      imageUrl: 'https://i.scdn.co/image/artist.jpg',
      genres: ['industrial'],
      spotifyUrl: 'https://open.spotify.com/artist/artist123',
    })
  })

  it('returns 403 when user is not admin or editor', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    mockSupabaseClient({ role: 'user' })
    const { POST } = await loadRoute()
    const response = await POST(
      new Request('http://localhost/api/admin/prefill-artist', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spotifyUrl: 'artist123' }),
      }) as never,
    )

    expect(response.status).toBe(403)
  })
})
