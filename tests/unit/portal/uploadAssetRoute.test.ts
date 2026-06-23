import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const createServerSupabaseClientMock = vi.fn()
const createServiceRoleSupabaseClientMock = vi.fn()
const resolvePortalArtistMock = vi.fn()
const createR2ClientMock = vi.fn()
const createAssetRecordMock = vi.fn()
const createArtistAssetMock = vi.fn()
const editorNotificationsInsertMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
  createServiceRoleSupabaseClient: createServiceRoleSupabaseClientMock,
}))

vi.mock('@/lib/api/artistProfiles', () => ({
  resolvePortalArtist: resolvePortalArtistMock,
}))

vi.mock('@/lib/r2Utils', () => ({
  createR2Client: createR2ClientMock,
  deleteObjectFromR2: vi.fn(),
}))

vi.mock('@/lib/api/assets', () => ({
  createAssetRecord: createAssetRecordMock,
}))

vi.mock('@/lib/api/artistAssets', () => ({
  createArtistAsset: createArtistAssetMock,
  deleteArtistAsset: vi.fn(),
}))

vi.mock('@/lib/env.server', () => ({
  serverEnv: {
    CLOUDFLARE_R2_ACCOUNT_ID: 'account',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'access-key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret-key',
    CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
    CLOUDFLARE_R2_PUBLIC_URL: 'https://cdn.example.com',
  },
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/upload-asset/route')
}

const ARTIST_ID = '123e4567-e89b-12d3-a456-426614174000'

function makeSupabaseClient() {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'folder-1' }, error: null })
  const eqMock = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }) })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })

  const usersInMock = vi.fn().mockResolvedValue({
    data: [{ id: 'admin-1' }, { id: 'editor-1' }],
    error: null,
  })
  const usersSelectMock = vi.fn().mockReturnValue({ in: usersInMock })
  const notificationsInsertMock = editorNotificationsInsertMock.mockResolvedValue({ error: null })

  const fromMock = vi.fn((table: string) => {
    if (table === 'asset_folders') return { select: selectMock }
    if (table === 'assets') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    }
    if (table === 'users') return { select: usersSelectMock }
    if (table === 'editor_notifications') return { insert: notificationsInsertMock }
    return { select: selectMock }
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: fromMock,
  }
}

function makeUploadFile(name: string, type: string) {
  const bytes = new Uint8Array([1, 2, 3])
  const file = new File([bytes], name, { type })
  if (typeof file.stream !== 'function') {
    Object.defineProperty(file, 'stream', {
      configurable: true,
      value: () => Readable.toWeb(Readable.from([bytes])),
    })
  }
  return file
}

function makeUploadRequest(file: File, pressSuggested = false) {
  const formData = new FormData()
  formData.append('file', file)
  if (pressSuggested) formData.append('pressSuggested', 'true')

  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? 'Bearer portal-token' : null),
    },
    formData: async () => formData,
    url: 'http://localhost/api/portal/upload-asset',
  } as unknown as NextRequest
}

describe('POST /api/portal/upload-asset', () => {
  beforeEach(() => {
    const supabase = makeSupabaseClient()
    createServerSupabaseClientMock.mockResolvedValue(supabase)
    createServiceRoleSupabaseClientMock.mockResolvedValue(supabase)
    resolvePortalArtistMock.mockResolvedValue({
      id: ARTIST_ID,
      name: 'Dark Artist',
      storageQuotaBytes: null,
    })
    createR2ClientMock.mockReturnValue({ send: vi.fn().mockResolvedValue({}) })
    createAssetRecordMock.mockResolvedValue({
      id: 'main-asset-1',
      filename: 'live.jpg',
      originalFilename: 'live.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      r2Key: 'artist-assets/test.jpg',
      publicUrl: 'https://cdn.example.com/artist-assets/test.jpg',
      createdAt: '2026-01-01T00:00:00Z',
      pressSuggested: false,
      isPressApproved: false,
      downloadableForPress: true,
      artistIds: [],
      tags: [],
    })
    createArtistAssetMock.mockResolvedValue({
      id: 'artist-asset-1',
      artistId: ARTIST_ID,
      filename: 'live.jpg',
      originalFilename: 'live.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      r2Key: 'artist-assets/test.jpg',
      publicUrl: 'https://cdn.example.com/artist-assets/test.jpg',
      createdAt: '2026-01-01T00:00:00Z',
    })
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

  it('sets press_suggested and notifies admins when an image is suggested for press', async () => {
    const { POST } = await loadRoute()
    const response = await POST(makeUploadRequest(makeUploadFile('live.jpg', 'image/jpeg'), true))

    expect(response.status).toBe(200)
    expect(createAssetRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        artist_id: ARTIST_ID,
        press_suggested: true,
      }),
    )
    expect(editorNotificationsInsertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        recipient_id: 'admin-1',
        type: 'press_asset_suggestion',
        entity_type: 'asset',
        entity_id: 'main-asset-1',
        entity_name: 'Dark Artist: live.jpg',
        sender_id: 'user-1',
        read: false,
      }),
      expect.objectContaining({ recipient_id: 'editor-1' }),
    ])
  })

  it('does not set press_suggested for non-image uploads even when checkbox is checked', async () => {
    const { POST } = await loadRoute()
    const response = await POST(makeUploadRequest(makeUploadFile('rider.pdf', 'application/pdf'), true))

    expect(response.status).toBe(200)
    expect(createAssetRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ press_suggested: false }),
    )
    expect(editorNotificationsInsertMock).not.toHaveBeenCalled()
  })

  it('skips editor notifications when pressSuggested is not set', async () => {
    const { POST } = await loadRoute()
    const response = await POST(makeUploadRequest(makeUploadFile('live.jpg', 'image/jpeg'), false))

    expect(response.status).toBe(200)
    expect(createAssetRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ press_suggested: false }),
    )
    expect(editorNotificationsInsertMock).not.toHaveBeenCalled()
  })
})