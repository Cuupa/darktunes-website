import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/errors'
const { authorize, overview } = vi.hoisted(() => ({ authorize: vi.fn(), overview: vi.fn() }))
vi.mock('@/lib/adminAuth', () => ({ requireAdminWithServiceClient: authorize }))
vi.mock('@/lib/api/syncOverview', () => ({ getSyncOverview: overview }))
import { GET } from '../../../app/api/admin/sync/artist-states/route'

beforeEach(() => {
  vi.clearAllMocks()
  authorize.mockResolvedValue({ serviceClient: {} })
  overview.mockResolvedValue({ items: [], providers: [], next_cursor: null })
})
describe('sync coverage endpoint', () => {
  it('rejects a non-admin before any sync data is read', async () => {
    authorize.mockRejectedValue(new ApiError(403, 'Administrator access required', 'FORBIDDEN'))
    const response = await GET(new NextRequest('https://example.com/api/admin/sync/artist-states'))
    expect(response.status).toBe(403)
    expect(overview).not.toHaveBeenCalled()
  })
  it('rejects unbounded limits and invalid cursors', async () => {
    for (const query of ['limit=101', 'limit=0', 'cursor=invalid']) {
      const response = await GET(new NextRequest(`https://example.com/api/admin/sync/artist-states?${query}`))
      expect(response.status).toBe(400)
    }
    expect(overview).not.toHaveBeenCalled()
  })
  it('returns private uncached pagination', async () => {
    const response = await GET(new NextRequest('https://example.com/api/admin/sync/artist-states?limit=10'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(overview).toHaveBeenCalledWith({}, 10, undefined)
  })
})
