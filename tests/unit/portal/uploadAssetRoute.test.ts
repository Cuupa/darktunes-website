import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/errors'
import { POST } from '../../../app/api/portal/upload-asset/route'

const authenticatePortalBearerWithArtistMock = vi.fn()

vi.mock('@/lib/portal/bearerAuth', () => ({
  authenticatePortalBearerWithArtist: (...args: unknown[]) =>
    authenticatePortalBearerWithArtistMock(...args),
}))

describe('POST /api/portal/upload-asset', () => {
  beforeEach(() => {
    authenticatePortalBearerWithArtistMock.mockImplementation(async (req: NextRequest) => {
      const token = req.headers.get('authorization')?.replace('Bearer ', '')
      if (!token) throw new ApiError(401, 'Missing authorization token')
      return {
        supabase: { from: vi.fn() },
        artist: { id: '123e4567-e89b-12d3-a456-426614174000' },
        user: { id: 'user-1' },
        token,
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects requests without Authorization header', async () => {
    const request = new NextRequest('http://localhost/api/portal/upload-asset', { method: 'POST' })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})