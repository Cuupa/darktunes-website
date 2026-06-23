import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const verifyPermissionMock = vi.fn()
const createServerSupabaseClientMock = vi.fn()
const getPressKitItemsMock = vi.fn()
const addToPressKitMock = vi.fn()
const removeFromPressKitMock = vi.fn()
const reorderPressKitMock = vi.fn()
const revalidateTagMock = vi.fn()

vi.mock('@/lib/adminAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/adminAuth')>()
  return {
    ...actual,
    verifyPermission: verifyPermissionMock,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}))

vi.mock('@/lib/api/pressKit', () => ({
  getPressKitItems: getPressKitItemsMock,
  addToPressKit: addToPressKitMock,
  removeFromPressKit: removeFromPressKitMock,
  reorderPressKit: reorderPressKitMock,
}))

vi.mock('next/cache', () => ({
  revalidateTag: revalidateTagMock,
}))

const AUTH = { authorization: 'Bearer admin-token' }

const mockKitItem = {
  id: 'kit-item-1',
  assetId: 'asset-1',
  artistId: 'artist-1',
  displayOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
}

async function loadPressKitRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/press-kit/route')
}

async function loadPressKitIdRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/press-kit/[id]/route')
}

async function loadPressKitReorderRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/press-kit/reorder/route')
}

describe('admin press-kit routes', () => {
  beforeEach(() => {
    verifyPermissionMock.mockResolvedValue('admin-user-1')
    createServerSupabaseClientMock.mockResolvedValue({})
    getPressKitItemsMock.mockResolvedValue([mockKitItem])
    addToPressKitMock.mockResolvedValue(mockKitItem)
    removeFromPressKitMock.mockResolvedValue(undefined)
    reorderPressKitMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/press-kit', () => {
    it('returns all kit items when no artistId filter is set', async () => {
      const { GET } = await loadPressKitRoute()
      const response = await GET(new NextRequest('http://localhost/api/admin/press-kit', { headers: AUTH }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.items).toEqual([mockKitItem])
      expect(getPressKitItemsMock).toHaveBeenCalledWith({})
      expect(verifyPermissionMock).toHaveBeenCalledWith('admin-token', 'can_view_admin_panel')
    })

    it('scopes to label-wide kit when artistId=label', async () => {
      const { GET } = await loadPressKitRoute()
      await GET(
        new NextRequest('http://localhost/api/admin/press-kit?artistId=label', { headers: AUTH }),
      )

      expect(getPressKitItemsMock).toHaveBeenCalledWith({}, null)
    })

    it('scopes to a specific artist when artistId is a UUID', async () => {
      const artistId = '123e4567-e89b-12d3-a456-426614174000'
      const { GET } = await loadPressKitRoute()
      await GET(
        new NextRequest(`http://localhost/api/admin/press-kit?artistId=${artistId}`, { headers: AUTH }),
      )

      expect(getPressKitItemsMock).toHaveBeenCalledWith({}, artistId)
    })

  })

  describe('POST /api/admin/press-kit', () => {
    it('adds an asset to the press kit and revalidates cache', async () => {
      const { POST } = await loadPressKitRoute()
      const response = await POST(
        new NextRequest('http://localhost/api/admin/press-kit', {
          method: 'POST',
          headers: { ...AUTH, 'content-type': 'application/json' },
          body: JSON.stringify({ assetId: 'asset-1', artistId: 'artist-1', displayOrder: 3 }),
        }),
      )
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.item).toEqual(mockKitItem)
      expect(addToPressKitMock).toHaveBeenCalledWith(
        {},
        { assetId: 'asset-1', artistId: 'artist-1', displayOrder: 3 },
      )
      expect(revalidateTagMock).toHaveBeenCalledWith('press-kit')
    })

    it('returns 400 when assetId is missing', async () => {
      const { POST } = await loadPressKitRoute()
      const response = await POST(
        new NextRequest('http://localhost/api/admin/press-kit', {
          method: 'POST',
          headers: { ...AUTH, 'content-type': 'application/json' },
          body: JSON.stringify({ artistId: 'artist-1' }),
        }),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ error: 'assetId is required' })
    })
  })

  describe('DELETE /api/admin/press-kit/[id]', () => {
    it('removes a kit item and revalidates cache', async () => {
      const { DELETE } = await loadPressKitIdRoute()
      const response = await DELETE(
        new NextRequest('http://localhost/api/admin/press-kit/kit-item-1', { headers: AUTH }),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ success: true })
      expect(removeFromPressKitMock).toHaveBeenCalledWith({}, 'kit-item-1')
      expect(revalidateTagMock).toHaveBeenCalledWith('press-kit')
    })
  })

  describe('PATCH /api/admin/press-kit/reorder', () => {
    it('reorders kit items for an artist scope', async () => {
      const { PATCH } = await loadPressKitReorderRoute()
      const response = await PATCH(
        new NextRequest('http://localhost/api/admin/press-kit/reorder', {
          method: 'PATCH',
          headers: { ...AUTH, 'content-type': 'application/json' },
          body: JSON.stringify({
            artistId: 'artist-1',
            orderedItemIds: ['kit-item-2', 'kit-item-1'],
          }),
        }),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ success: true })
      expect(reorderPressKitMock).toHaveBeenCalledWith({}, 'artist-1', ['kit-item-2', 'kit-item-1'])
      expect(revalidateTagMock).toHaveBeenCalledWith('press-kit')
    })

    it('returns 400 when orderedItemIds is empty', async () => {
      const { PATCH } = await loadPressKitReorderRoute()
      const response = await PATCH(
        new NextRequest('http://localhost/api/admin/press-kit/reorder', {
          method: 'PATCH',
          headers: { ...AUTH, 'content-type': 'application/json' },
          body: JSON.stringify({ artistId: 'artist-1', orderedItemIds: [] }),
        }),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        error: 'orderedItemIds must contain at least one id',
      })
    })
  })
})