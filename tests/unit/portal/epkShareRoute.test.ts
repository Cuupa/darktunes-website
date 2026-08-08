/**
 * Golden auth tests for /api/portal/epk/share after C1 membership migration.
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
const listEpkShareLinksMock = vi.fn()
const createEpkShareLinkMock = vi.fn()
const revokeEpkShareLinkMock = vi.fn()

vi.mock('@/lib/portal/withPortalMembership', () => ({
  withPortalMembershipWrite: withPortalMembershipWriteMock,
  portalMemberWrite: portalMemberWriteMock,
}))

vi.mock('@/lib/api/epkShareLinks', () => ({
  listEpkShareLinks: listEpkShareLinksMock,
  createEpkShareLink: createEpkShareLinkMock,
  revokeEpkShareLink: revokeEpkShareLinkMock,
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/epk/share/route')
}

describe('/api/portal/epk/share', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withPortalMembershipWriteMock.mockResolvedValue(makePortalMembershipContext())
    portalMemberWriteMock.mockImplementation(async (_ctx, _meta, write) => {
      const value = await write({ kind: 'service' })
      return { value, via: 'service_role', fellBack: false }
    })
    listEpkShareLinksMock.mockResolvedValue([{ id: 'link-1' }])
    createEpkShareLinkMock.mockResolvedValue({ id: 'link-new', token: 'abc' })
    revokeEpkShareLinkMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('GET golden: 401', async () => {
    withPortalMembershipWriteMock.mockImplementation(() =>
      rejectApiError(401, 'Invalid or expired token'),
    )
    const { GET } = await loadRoute()
    const res = await GET(
      jsonRequest('/api/portal/epk/share', {
        method: 'GET',
        searchParams: { artist_id: TEST_ARTIST_ID },
      }),
    )
    await expectUnauthorized(res)
  })

  it('GET golden: 403', async () => {
    withPortalMembershipWriteMock.mockImplementation(() =>
      rejectApiError(403, 'No artist linked to this account'),
    )
    const { GET } = await loadRoute()
    const res = await GET(
      jsonRequest('/api/portal/epk/share', {
        method: 'GET',
        bearer: 'tok',
        searchParams: { artist_id: TEST_ARTIST_ID },
      }),
    )
    await expectForbidden(res)
  })

  it('GET golden: 200', async () => {
    const { GET } = await loadRoute()
    const res = await GET(
      jsonRequest('/api/portal/epk/share', {
        method: 'GET',
        bearer: 'tok',
        searchParams: { artist_id: TEST_ARTIST_ID },
      }),
    )
    const body = await expectOk<{ links: { id: string }[] }>(res, 200)
    expect(body.links).toHaveLength(1)
    expect(portalMemberWriteMock).toHaveBeenCalled()
  })

  it('POST golden: 200 create', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/portal/epk/share', {
        method: 'POST',
        bearer: 'tok',
        body: { artist_id: TEST_ARTIST_ID, label: 'Press' },
      }),
    )
    const body = await expectOk<{ link: { id: string } }>(res, 200)
    expect(body.link.id).toBe('link-new')
    expect(createEpkShareLinkMock).toHaveBeenCalled()
  })
})
