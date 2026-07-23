/**
 * Golden auth tests for POST /api/portal/messages/send (cookie-session path).
 * API SOTA Phase B3 — will migrate to Bearer in Phase C2.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TEST_ARTIST_B_ID,
  TEST_ARTIST_ID,
  expectForbidden,
  expectOk,
  expectUnauthorized,
  jsonRequest,
  makeCookieSessionSupabase,
} from '../../helpers/api/routeTestkit'

const createServerSupabaseClientMock = vi.fn()
const createServiceRoleSupabaseClientMock = vi.fn()
const sendPortalMessageMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
  createServiceRoleSupabaseClient: createServiceRoleSupabaseClientMock,
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
    createServerSupabaseClientMock.mockResolvedValue(
      makeCookieSessionSupabase({ authenticated: true, membership: { id: 'mem-1' } }),
    )
    createServiceRoleSupabaseClientMock.mockResolvedValue(
      makeCookieSessionSupabase({ authenticated: true }),
    )
    sendPortalMessageMock.mockResolvedValue({
      id: 'msg-1',
      subject: 'Hello',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('golden: 401 without session', async () => {
    createServerSupabaseClientMock.mockResolvedValue(
      makeCookieSessionSupabase({ authenticated: false }),
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
    createServerSupabaseClientMock.mockResolvedValue(
      makeCookieSessionSupabase({ authenticated: true, membership: null }),
    )
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/portal/messages/send', {
        method: 'POST',
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
    createServerSupabaseClientMock.mockResolvedValue(
      makeCookieSessionSupabase({
        authenticated: true,
        membership: { id: 'mem-1' },
        targetArtist: null,
      }),
    )
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/portal/messages/send', {
        method: 'POST',
        body: validBody,
      }),
    )
    expect(res.status).toBe(404)
  })
})
