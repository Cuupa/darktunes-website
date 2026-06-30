import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const verifyAdminOrEditorMock = vi.fn()
const setArtistLandingPublishTrustedMock = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  extractBearerToken: () => 'test-token',
  verifyAdminOrEditor: verifyAdminOrEditorMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: 'artist-1' }, error: null }),
        }),
      }),
    }),
  })),
}))

vi.mock('@/lib/api/fanPageDocument', () => ({
  setArtistLandingPublishTrusted: setArtistLandingPublishTrustedMock,
}))

async function importRoute() {
  return import('../../../app/api/admin/fan-page/review/[artistId]/trusted/route')
}

describe('PATCH /api/admin/fan-page/review/[artistId]/trusted', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyAdminOrEditorMock.mockResolvedValue('admin-user-id')
    setArtistLandingPublishTrustedMock.mockResolvedValue(undefined)
  })

  it('updates trusted fan page publish flag', async () => {
    const { PATCH } = await importRoute()
    const request = new NextRequest(
      'http://localhost/api/admin/fan-page/review/artist-1/trusted',
      {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ trusted: true }),
      },
    )

    const response = await PATCH(request)
    expect(response.status).toBe(200)
    expect(setArtistLandingPublishTrustedMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(Function) }),
      'artist-1',
      true,
    )
    const json = await response.json()
    expect(json).toEqual({ artistId: 'artist-1', landingPublishTrusted: true })
  })
})