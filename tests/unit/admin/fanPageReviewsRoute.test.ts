import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const verifyAdminOrEditorMock = vi.fn()
const listFanPageReviewsMock = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  extractBearerToken: () => 'test-token',
  verifyAdminOrEditor: verifyAdminOrEditorMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({})),
}))

vi.mock('@/lib/api/fanPageDocument', () => ({
  listFanPageReviews: listFanPageReviewsMock,
}))

async function importRoute() {
  return import('../../../app/api/admin/fan-page/reviews/route')
}

describe('GET /api/admin/fan-page/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyAdminOrEditorMock.mockResolvedValue('admin-user-id')
  })

  it('returns fan page review list for admins', async () => {
    listFanPageReviewsMock.mockResolvedValue([
      {
        artistId: 'artist-1',
        artistName: 'Test Band',
        artistSlug: 'test-band',
        landingPublishTrusted: false,
        publishStatus: 'pending_review',
        documentVersion: 3,
        templateId: 'dark-minimal',
        seoTitle: null,
        seoDescription: null,
        reviewComment: null,
        reviewedAt: null,
        publishedAt: null,
        updatedAt: '2026-06-30T12:00:00.000Z',
        createdAt: '2026-06-01T12:00:00.000Z',
      },
    ])

    const { GET } = await importRoute()
    const request = new NextRequest('http://localhost/api/admin/fan-page/reviews?status=pending_review', {
      headers: { authorization: 'Bearer test-token' },
    })

    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(listFanPageReviewsMock).toHaveBeenCalledWith({}, 'pending_review')
    const json = await response.json()
    expect(json).toHaveLength(1)
    expect(json[0].artistSlug).toBe('test-band')
  })

  it('rejects invalid status filters', async () => {
    const { GET } = await importRoute()
    const request = new NextRequest('http://localhost/api/admin/fan-page/reviews?status=invalid', {
      headers: { authorization: 'Bearer test-token' },
    })

    const response = await GET(request)
    expect(response.status).toBe(400)
    expect(listFanPageReviewsMock).not.toHaveBeenCalled()
  })
})