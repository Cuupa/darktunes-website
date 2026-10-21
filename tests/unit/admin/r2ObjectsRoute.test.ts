import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const verifyPermission = vi.fn()
const extractBearerToken = vi.fn()
const createConfiguredR2Client = vi.fn()
const listR2ExplorerPage = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  verifyPermission: (...args: unknown[]) => verifyPermission(...args),
  extractBearerToken: (...args: unknown[]) => extractBearerToken(...args),
}))

vi.mock('@/lib/r2Utils', () => ({
  createConfiguredR2Client: () => createConfiguredR2Client(),
}))

vi.mock('@/lib/r2/explorer', () => ({
  listR2ExplorerPage: (...args: unknown[]) => listR2ExplorerPage(...args),
}))

describe('GET /api/admin/assets/r2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    extractBearerToken.mockReturnValue('token-1')
    verifyPermission.mockResolvedValue(undefined)
    createConfiguredR2Client.mockResolvedValue({
      s3: {},
      bucket: 'bucket-1',
    })
  })

  it('lists objects under a prefix with cursor pagination', async () => {
    listR2ExplorerPage.mockResolvedValue({
      objects: [
        { key: 'uploads/a.jpg', sizeBytes: 100, lastModified: new Date('2024-01-01') },
      ],
      nextCursor: 'cursor-2',
      truncated: true,
    })

    const { GET } = await import('../../../app/api/admin/assets/r2/route')
    const res = await GET(
      new NextRequest(
        'http://localhost/api/admin/assets/r2?prefix=uploads/&cursor=cursor-1&limit=50',
      ),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(listR2ExplorerPage).toHaveBeenCalledWith(
      {},
      'bucket-1',
      expect.objectContaining({ prefix: 'uploads/', cursor: 'cursor-1', limit: 50 }),
    )
    expect(body.objects).toHaveLength(1)
    expect(body.nextCursor).toBe('cursor-2')
    expect(body.truncated).toBe(true)
    expect(body.search).toBeNull()
  })

  it('requires admin panel permission', async () => {
    verifyPermission.mockRejectedValueOnce(new Error('forbidden'))
    const { GET } = await import('../../../app/api/admin/assets/r2/route')
    const res = await GET(
      new NextRequest('http://localhost/api/admin/assets/r2'),
    )
    expect(res.status).not.toBe(200)
  })
})
