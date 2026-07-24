/**
 * Golden auth for GET /api/admin/artists after Phase D migration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  expectForbidden,
  expectOk,
  expectUnauthorized,
  jsonRequest,
  rejectApiError,
} from '../../helpers/api/routeTestkit'

const requireAdminFromRequestMock = vi.fn()
const getArtistsMock = vi.fn()
const createServiceRoleSupabaseClientMock = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  requireAdminFromRequest: requireAdminFromRequestMock,
}))

vi.mock('@/lib/api/artists', () => ({
  getArtists: getArtistsMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleSupabaseClient: createServiceRoleSupabaseClientMock,
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/artists/route')
}

describe('GET /api/admin/artists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminFromRequestMock.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    createServiceRoleSupabaseClientMock.mockResolvedValue({ kind: 'service' })
    getArtistsMock.mockResolvedValue([{ id: 'a1', name: 'Band', slug: 'band' }])
  })

  it('golden: 401', async () => {
    requireAdminFromRequestMock.mockImplementation(() => rejectApiError(401, 'Unauthorized'))
    const { GET } = await loadRoute()
    await expectUnauthorized(await GET(jsonRequest('/api/admin/artists', { method: 'GET' })))
  })

  it('golden: 403', async () => {
    requireAdminFromRequestMock.mockImplementation(() => rejectApiError(403, 'Forbidden'))
    const { GET } = await loadRoute()
    await expectForbidden(
      await GET(jsonRequest('/api/admin/artists', { method: 'GET', bearer: 'tok' })),
    )
  })

  it('golden: 200', async () => {
    const { GET } = await loadRoute()
    const body = await expectOk<{ artists: { id: string }[] }>(
      await GET(jsonRequest('/api/admin/artists', { method: 'GET', bearer: 'tok' })),
      200,
    )
    expect(body.artists[0]?.id).toBe('a1')
  })
})
