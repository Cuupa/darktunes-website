/**
 * Golden auth tests for DELETE /api/portal/documents/[id] (C1 membership migration).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TEST_ARTIST_ID,
  expectForbidden,
  expectOk,
  expectUnauthorized,
  jsonRequest,
  makePortalMembershipContext,
  rejectApiError,
} from '../../helpers/api/routeTestkit'

const withPortalMembershipWriteMock = vi.fn()
const portalMemberWriteMock = vi.fn()
const getArtistDocumentMock = vi.fn()
const deleteArtistDocumentMock = vi.fn()
const createR2ClientMock = vi.fn()
const s3SendMock = vi.fn()

vi.mock('@/lib/portal/withPortalMembership', () => ({
  withPortalMembershipWrite: withPortalMembershipWriteMock,
  portalMemberWrite: portalMemberWriteMock,
}))

vi.mock('@/lib/api/artistDocuments', () => ({
  getArtistDocument: getArtistDocumentMock,
  deleteArtistDocument: deleteArtistDocumentMock,
}))

vi.mock('@/lib/r2Utils', () => ({
  createR2Client: createR2ClientMock,
}))

vi.mock('@/lib/env.server', () => ({
  serverEnv: {
    CLOUDFLARE_R2_ACCOUNT_ID: 'a',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'k',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 's',
    CLOUDFLARE_R2_BUCKET_NAME: 'b',
  },
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/documents/[id]/route')
}

function docRequest(artistId = TEST_ARTIST_ID) {
  return jsonRequest(`/api/portal/documents/doc-1?artistId=${artistId}`, {
    method: 'DELETE',
    bearer: 'tok',
  })
}

describe('DELETE /api/portal/documents/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withPortalMembershipWriteMock.mockResolvedValue(makePortalMembershipContext())
    portalMemberWriteMock.mockImplementation(async (_ctx, meta, write) => {
      const value = await write({ kind: 'service' })
      return { value, via: 'service_role', fellBack: false, meta }
    })
    getArtistDocumentMock.mockResolvedValue({
      id: 'doc-1',
      filePath: 'documents/artist/file.pdf',
    })
    deleteArtistDocumentMock.mockResolvedValue(undefined)
    s3SendMock.mockResolvedValue({})
    createR2ClientMock.mockReturnValue({ send: s3SendMock })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('golden: 401 without membership (auth)', async () => {
    withPortalMembershipWriteMock.mockImplementation(() =>
      rejectApiError(401, 'Invalid or expired token'),
    )
    const { DELETE } = await loadRoute()
    const res = await DELETE(docRequest())
    await expectUnauthorized(res)
  })

  it('golden: 403 when not a member', async () => {
    withPortalMembershipWriteMock.mockImplementation(() =>
      rejectApiError(403, 'No artist linked to this account'),
    )
    const { DELETE } = await loadRoute()
    const res = await DELETE(docRequest())
    await expectForbidden(res)
  })

  it('golden: 200 deletes R2 then DB via portalMemberWrite', async () => {
    const { DELETE } = await loadRoute()
    // Pathname ends with id for route parser
    const req = jsonRequest('/api/portal/documents/doc-1', {
      method: 'DELETE',
      bearer: 'tok',
      searchParams: { artistId: TEST_ARTIST_ID },
    })
    const res = await DELETE(req)
    await expectOk(res, 200)
    expect(withPortalMembershipWriteMock).toHaveBeenCalled()
    expect(portalMemberWriteMock).toHaveBeenCalled()
    expect(s3SendMock).toHaveBeenCalled()
    expect(deleteArtistDocumentMock).toHaveBeenCalled()
  })

  it('404 when document missing', async () => {
    getArtistDocumentMock.mockResolvedValue(null)
    const { DELETE } = await loadRoute()
    const res = await DELETE(
      jsonRequest('/api/portal/documents/missing', {
        method: 'DELETE',
        bearer: 'tok',
        searchParams: { artistId: TEST_ARTIST_ID },
      }),
    )
    expect(res.status).toBe(404)
  })
})
