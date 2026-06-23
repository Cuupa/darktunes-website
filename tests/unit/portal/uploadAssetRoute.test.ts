import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createServerSupabaseClientMock = vi.fn()
const resolvePortalArtistMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/api/artistProfiles', () => ({
  resolvePortalArtist: resolvePortalArtistMock,
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/upload-asset/route')
}

describe('POST /api/portal/upload-asset', () => {
  beforeEach(() => {
    createServerSupabaseClientMock.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    })
    resolvePortalArtistMock.mockResolvedValue({ id: '123e4567-e89b-12d3-a456-426614174000' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects requests without Authorization header', async () => {
    const { POST } = await loadRoute()
    const request = new NextRequest('http://localhost/api/portal/upload-asset', { method: 'POST' })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})