import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const verifyPermissionMock = vi.fn()
const createServerSupabaseClientMock = vi.fn()
const bulkSetPressApprovedMock = vi.fn()
const bulkAddToPressKitMock = vi.fn()
const bulkRemoveFromPressKitByAssetIdsMock = vi.fn()
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

vi.mock('@/lib/api/assets', () => ({
  bulkSetPressApproved: bulkSetPressApprovedMock,
}))

vi.mock('@/lib/api/pressKit', () => ({
  bulkAddToPressKit: bulkAddToPressKitMock,
  bulkRemoveFromPressKitByAssetIds: bulkRemoveFromPressKitByAssetIdsMock,
}))

vi.mock('next/cache', () => ({
  revalidateTag: revalidateTagMock,
}))

const AUTH = { authorization: 'Bearer admin-token' }
const ASSET_IDS = ['asset-1', 'asset-2']

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/assets/bulk-press/route')
}

function postBulkPress(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/assets/bulk-press', {
    method: 'POST',
    headers: { ...AUTH, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/assets/bulk-press', () => {
  beforeEach(() => {
    verifyPermissionMock.mockResolvedValue('admin-user-1')
    createServerSupabaseClientMock.mockResolvedValue({})
    bulkSetPressApprovedMock.mockResolvedValue(2)
    bulkAddToPressKitMock.mockResolvedValue([{ id: 'kit-1' }, { id: 'kit-2' }])
    bulkRemoveFromPressKitByAssetIdsMock.mockResolvedValue(2)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('approves press assets and revalidates press-kit cache', async () => {
    const { POST } = await loadRoute()
    const response = await POST(postBulkPress({ assetIds: ASSET_IDS, action: 'approve' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, affected: 2 })
    expect(bulkSetPressApprovedMock).toHaveBeenCalledWith({}, ASSET_IDS, true)
    expect(revalidateTagMock).toHaveBeenCalledWith('press-kit', 'max')
  })

  it('unapproves press assets', async () => {
    const { POST } = await loadRoute()
    const response = await POST(postBulkPress({ assetIds: ASSET_IDS, action: 'unapprove' }))

    expect(response.status).toBe(200)
    expect(bulkSetPressApprovedMock).toHaveBeenCalledWith({}, ASSET_IDS, false)
    expect(revalidateTagMock).toHaveBeenCalledWith('press-kit', 'max')
  })

  it('adds assets to the press kit for an artist scope', async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      postBulkPress({ assetIds: ASSET_IDS, action: 'addToKit', artistId: 'artist-1' }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, affected: 2 })
    expect(bulkAddToPressKitMock).toHaveBeenCalledWith({}, ASSET_IDS, 'artist-1')
    expect(revalidateTagMock).toHaveBeenCalledWith('press-kit', 'max')
  })

  it('removes assets from the press kit', async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      postBulkPress({ assetIds: ASSET_IDS, action: 'removeFromKit', artistId: null }),
    )

    expect(response.status).toBe(200)
    expect(bulkRemoveFromPressKitByAssetIdsMock).toHaveBeenCalledWith({}, ASSET_IDS, null)
    expect(revalidateTagMock).toHaveBeenCalledWith('press-kit', 'max')
  })

  it('returns 400 when assetIds is empty', async () => {
    const { POST } = await loadRoute()
    const response = await POST(postBulkPress({ assetIds: [], action: 'approve' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'At least one asset id is required',
    })
  })

  it('returns 400 when action is missing', async () => {
    const { POST } = await loadRoute()
    const response = await POST(postBulkPress({ assetIds: ASSET_IDS }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'action is required' })
  })

  it('returns 400 for unknown actions', async () => {
    const { POST } = await loadRoute()
    const response = await POST(postBulkPress({ assetIds: ASSET_IDS, action: 'archive' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unknown action: archive' })
  })

})