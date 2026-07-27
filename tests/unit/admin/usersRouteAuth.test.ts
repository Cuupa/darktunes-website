/**
 * Golden auth for GET /api/admin/users after Phase D migration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  expectForbidden,
  expectOk,
  expectUnauthorized,
  jsonRequest,
  rejectApiError,
} from '../../helpers/api/routeTestkit'

const requireAdminWithServiceClientMock = vi.fn()
const listUsersWithProfilesMock = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  requireAdminWithServiceClient: requireAdminWithServiceClientMock,
}))

vi.mock('@/lib/api/users', () => ({
  listUsersWithProfiles: listUsersWithProfilesMock,
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/users/route')
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminWithServiceClientMock.mockResolvedValue({
      userId: 'admin-1',
      role: 'admin',
      serviceClient: { kind: 'service' },
    })
    listUsersWithProfilesMock.mockResolvedValue([{ id: 'u1', email: 'a@b.c' }])
  })

  it('golden: 401', async () => {
    requireAdminWithServiceClientMock.mockImplementation(() =>
      rejectApiError(401, 'Unauthorized'),
    )
    const { GET } = await loadRoute()
    const res = await GET(jsonRequest('/api/admin/users', { method: 'GET' }))
    await expectUnauthorized(res)
  })

  it('golden: 403', async () => {
    requireAdminWithServiceClientMock.mockImplementation(() =>
      rejectApiError(403, 'Forbidden'),
    )
    const { GET } = await loadRoute()
    const res = await GET(
      jsonRequest('/api/admin/users', { method: 'GET', bearer: 'tok' }),
    )
    await expectForbidden(res)
  })

  it('golden: 200', async () => {
    const { GET } = await loadRoute()
    const res = await GET(
      jsonRequest('/api/admin/users', { method: 'GET', bearer: 'tok' }),
    )
    const body = await expectOk<{ users: { id: string }[] }>(res, 200)
    expect(body.users).toHaveLength(1)
    expect(listUsersWithProfilesMock).toHaveBeenCalled()
  })
})
