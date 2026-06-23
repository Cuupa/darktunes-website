import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiError } from '@/lib/errors'

const getUser = vi.fn()
const createBearerAuthSupabaseClient = vi.fn()
const createServerSupabaseClient = vi.fn()
const resolvePortalArtist = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: () => createServerSupabaseClient(),
  createBearerAuthSupabaseClient: (token: string) => createBearerAuthSupabaseClient(token),
}))

vi.mock('@/lib/api/artistProfiles', () => ({
  resolvePortalArtist: (...args: unknown[]) => resolvePortalArtist(...args),
}))

import { authenticatePortalBearer, authenticatePortalBearerWithArtist } from './bearerAuth'

function makeRequest(authHeader: string | null) {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : null),
    },
  } as never
}

describe('authenticatePortalBearer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createServerSupabaseClient.mockResolvedValue({ auth: { getUser } })
    createBearerAuthSupabaseClient.mockResolvedValue({ from: vi.fn() })
  })

  it('throws when Authorization header is missing', async () => {
    await expect(authenticatePortalBearer(makeRequest(null))).rejects.toBeInstanceOf(ApiError)
  })

  it('returns bearer-authenticated client for valid token', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    const bearerClient = { from: vi.fn() }
    createBearerAuthSupabaseClient.mockResolvedValue(bearerClient)

    const result = await authenticatePortalBearer(makeRequest('Bearer token-abc'))
    expect(result.user.id).toBe('user-1')
    expect(result.supabase).toBe(bearerClient)
    expect(createBearerAuthSupabaseClient).toHaveBeenCalledWith('token-abc')
  })
})

describe('authenticatePortalBearerWithArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createServerSupabaseClient.mockResolvedValue({ auth: { getUser } })
    createBearerAuthSupabaseClient.mockResolvedValue({ from: vi.fn() })
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  it('returns artist when resolvePortalArtist succeeds', async () => {
    const artist = { id: 'artist-1', name: 'Test Artist' }
    resolvePortalArtist.mockResolvedValue(artist)

    const result = await authenticatePortalBearerWithArtist(makeRequest('Bearer token-abc'), 'artist-1')
    expect(result.artist).toBe(artist)
    expect(resolvePortalArtist).toHaveBeenCalledWith(expect.anything(), 'user-1', 'artist-1')
  })

  it('throws 403 when resolvePortalArtist returns FORBIDDEN', async () => {
    resolvePortalArtist.mockRejectedValue(new Error('FORBIDDEN: no access'))

    await expect(
      authenticatePortalBearerWithArtist(makeRequest('Bearer token-abc'), 'artist-1'),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('throws 403 when resolvePortalArtist returns null', async () => {
    resolvePortalArtist.mockResolvedValue(null)

    await expect(
      authenticatePortalBearerWithArtist(makeRequest('Bearer token-abc')),
    ).rejects.toMatchObject({ status: 403 })
  })
})