/**
 * Golden auth tests for POST /api/portal/messages/send
 * (membership write helpers + dual auth via withPortalMembershipWrite).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TEST_ARTIST_B_ID,
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
const sendPortalMessageMock = vi.fn()

vi.mock('@/lib/portal/withPortalMembership', () => ({
  withPortalMembershipWrite: withPortalMembershipWriteMock,
  portalMemberWrite: portalMemberWriteMock,
}))

vi.mock('@/lib/api/portalMessages', () => ({
  sendPortalMessage: sendPortalMessageMock,
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/messages/send/route')
}

const validBody = {
  fromArtistId: TEST_ARTIST_ID,
  toArtistId: TEST_ARTIST_B_ID,
  subject: 'Hello',
  body: 'Test message',
}

describe('POST /api/portal/messages/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = makePortalMembershipContext({
      serviceDb: {
        from: (table: string) => {
          if (table === 'artists') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { name: 'Band' }, error: null }),
                }),
              }),
            }
          }
          if (table === 'users') {
            return {
              select: () => ({
                in: async () => ({ data: [], error: null }),
              }),
            }
          }
          return {
            insert: async () => ({ error: null }),
          }
        },
      },
    })
    withPortalMembershipWriteMock.mockResolvedValue(ctx)
    portalMemberWriteMock.mockImplementation(async (_c, meta, write) => {
      if (meta.table === 'artists' && meta.operation === 'select') {
        return { value: { id: TEST_ARTIST_B_ID }, via: 'service_role', fellBack: false }
      }
      if (meta.table === 'portal_messages') {
        const value = await write({})
        return { value, via: 'service_role', fellBack: false }
      }
      const value = await write({})
      return { value, via: 'service_role', fellBack: false }
    })
    sendPortalMessageMock.mockResolvedValue({
      id: 'msg-1',
      subject: 'Hello',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('golden: 401 without auth', async () => {
    withPortalMembershipWriteMock.mockImplementation(() =>
      rejectApiError(401, 'Missing authorization token'),
    )
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/portal/messages/send', {
        method: 'POST',
        body: validBody,
      }),
    )
    await expectUnauthorized(res)
    expect(sendPortalMessageMock).not.toHaveBeenCalled()
  })

  it('golden: 403 when not a member of fromArtistId', async () => {
    withPortalMembershipWriteMock.mockImplementation(() =>
      rejectApiError(403, 'No artist linked to this account'),
    )
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/portal/messages/send', {
        method: 'POST',
        bearer: 'tok',
        body: validBody,
      }),
    )
    await expectForbidden(res)
    expect(sendPortalMessageMock).not.toHaveBeenCalled()
  })

  it('golden: 201 on successful send to artist', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/portal/messages/send', {
        method: 'POST',
        bearer: 'tok',
        body: validBody,
      }),
    )
    const body = await expectOk<{ message: { id: string } }>(res, 201)
    expect(body.message.id).toBe('msg-1')
    expect(sendPortalMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        fromArtistId: TEST_ARTIST_ID,
        toArtistId: TEST_ARTIST_B_ID,
        subject: 'Hello',
      }),
    )
  })

  it('404 when recipient artist does not exist', async () => {
    portalMemberWriteMock.mockImplementation(async (_c, meta, write) => {
      if (meta.table === 'artists') {
        return { value: null, via: 'service_role', fellBack: false }
      }
      return { value: await write({}), via: 'service_role', fellBack: false }
    })
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/portal/messages/send', {
        method: 'POST',
        bearer: 'tok',
        body: validBody,
      }),
    )
    expect(res.status).toBe(404)
  })
})
