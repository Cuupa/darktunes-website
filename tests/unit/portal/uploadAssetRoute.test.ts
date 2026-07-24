import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/lib/errors'
import {
  TEST_ARTIST_ID,
  makePortalMembershipContext,
  rejectApiError,
} from '../../helpers/api/routeTestkit'

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/upload-asset/route')
}

const withPortalMembershipWriteMock = vi.fn()
const portalMemberWriteMock = vi.fn()
const createR2ClientMock = vi.fn()
const createAssetRecordMock = vi.fn()
const createArtistAssetMock = vi.fn()
const editorNotificationsInsertMock = vi.fn()

vi.mock('@/lib/portal/withPortalMembership', () => ({
  withPortalMembershipWrite: withPortalMembershipWriteMock,
  portalMemberWrite: portalMemberWriteMock,
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
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? 'Bearer portal-token' : null,
    },
    formData: async () => formData,
    url: `http://localhost/api/portal/upload-asset?artistId=${TEST_ARTIST_ID}`,
  } as unknown as NextRequest
}

describe('POST /api/portal/upload-asset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const serviceDb = {
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: 'admin-1' }, { id: 'editor-1' }],
                error: null,
              }),
            }),
          }
        }
        if (table === 'editor_notifications') {
          return { insert: editorNotificationsInsertMock.mockResolvedValue({ error: null }) }
        }
        if (table === 'asset_folders') {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { id: 'folder-1' }, error: null }),
                }),
                maybeSingle: async () => ({ data: { id: 'folder-1' }, error: null }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'landing-1' }, error: null }),
              }),
            }),
          }
        }
        return { select: () => ({ eq: async () => ({ data: [], error: null }) }) }
      },
    }

    withPortalMembershipWriteMock.mockResolvedValue(
      makePortalMembershipContext({
        artistId: TEST_ARTIST_ID,
        serviceDb,
      }),
    )

    portalMemberWriteMock.mockImplementation(async (_ctx, meta, write) => {
      if (meta.table === 'assets' && meta.operation === 'select') {
        return { value: 0, via: 'service_role', fellBack: false }
      }
      if (meta.table === 'asset_folders') {
        return { value: 'folder-1', via: 'service_role', fellBack: false }
      }
      if (meta.table === 'assets' && meta.operation === 'insert') {
        const value = await write(serviceDb)
        return { value, via: 'service_role', fellBack: false }
      }
      if (meta.table === 'artist_assets') {
        const value = await write(serviceDb)
        return { value, via: 'service_role', fellBack: false }
      }
      return { value: await write(serviceDb), via: 'service_role', fellBack: false }
    })

    createAssetRecordMock.mockResolvedValue({ id: 'asset-main-1' })
    createArtistAssetMock.mockResolvedValue({ id: 'artist-asset-1', public_url: 'https://cdn.example.com/x' })
    createR2ClientMock.mockReturnValue({
      send: vi.fn().mockResolvedValue({}),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('401 when membership auth fails', async () => {
    withPortalMembershipWriteMock.mockImplementation(() =>
      rejectApiError(401, 'Missing authorization token'),
    )
    const { POST } = await loadRoute()
    const res = await POST(makeUploadRequest(makeUploadFile('a.jpg', 'image/jpeg')))
    expect(res.status).toBe(401)
  })

  it('uploads asset and returns artist asset', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeUploadRequest(makeUploadFile('photo.jpg', 'image/jpeg')))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { asset: { id: string } }
    expect(body.asset.id).toBe('artist-asset-1')
    expect(createAssetRecordMock).toHaveBeenCalled()
    expect(createArtistAssetMock).toHaveBeenCalled()
  })

  it('notifies staff when press suggested', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeUploadRequest(makeUploadFile('photo.jpg', 'image/jpeg'), true))
    expect(res.status).toBe(200)
    expect(editorNotificationsInsertMock).toHaveBeenCalled()
  })

  it('rejects missing file', async () => {
    const { POST } = await loadRoute()
    const formData = new FormData()
    const req = {
      headers: { get: () => 'Bearer t' },
      formData: async () => formData,
      url: `http://localhost/api/portal/upload-asset?artistId=${TEST_ARTIST_ID}`,
    } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
