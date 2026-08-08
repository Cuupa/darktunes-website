/**
 * Golden + happy-path tests for /api/portal/billing-profile (API SOTA Phase B3).
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

const authenticatePortalBearerMock = vi.fn()
const resolvePortalArtistMock = vi.fn()
const createServiceRoleSupabaseClientMock = vi.fn()
const getBillingProfileMock = vi.fn()
const upsertBillingProfileMock = vi.fn()
const isBillingProfileCompleteMock = vi.fn()
const withPortalMembershipMock = vi.fn()
const portalMemberWriteMock = vi.fn()

vi.mock('@/lib/portal/bearerAuth', () => ({
  authenticatePortalBearer: authenticatePortalBearerMock,
}))

vi.mock('@/lib/api/artistProfiles', () => ({
  resolvePortalArtist: resolvePortalArtistMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleSupabaseClient: createServiceRoleSupabaseClientMock,
}))

vi.mock('@/lib/api/artistBillingProfiles', () => ({
  getBillingProfile: getBillingProfileMock,
  upsertBillingProfile: upsertBillingProfileMock,
  isBillingProfileComplete: isBillingProfileCompleteMock,
}))

vi.mock('@/lib/portal/withPortalMembership', () => ({
  withPortalMembership: withPortalMembershipMock,
  portalMemberWrite: portalMemberWriteMock,
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/billing-profile/route')
}

const validBody = {
  artist_id: TEST_ARTIST_ID,
  legal_name: 'Test Band GmbH',
  street: 'Hauptstr. 1',
  postal_code: '10115',
  city: 'Berlin',
  country: 'DE',
  is_small_business: false,
}

describe('/api/portal/billing-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const serviceDb = { kind: 'service' }
    createServiceRoleSupabaseClientMock.mockResolvedValue(serviceDb)
    authenticatePortalBearerMock.mockResolvedValue({
      token: 'tok',
      user: { id: 'user-1' },
      supabase: { kind: 'user' },
    })
    resolvePortalArtistMock.mockResolvedValue({ id: TEST_ARTIST_ID, slug: 'band' })
    getBillingProfileMock.mockResolvedValue({ legalName: 'Test' })
    isBillingProfileCompleteMock.mockReturnValue(true)
    upsertBillingProfileMock.mockResolvedValue({ legalName: 'Test Band GmbH' })

    withPortalMembershipMock.mockResolvedValue(makePortalMembershipContext())
    portalMemberWriteMock.mockImplementation(async (_ctx, _meta, write) => {
      const value = await write(serviceDb)
      return { value, via: 'service_role', fellBack: false }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GET golden auth', () => {
    it('401 without Bearer', async () => {
      authenticatePortalBearerMock.mockImplementation(() =>
        rejectApiError(401, 'Invalid or expired token'),
      )
      const { GET } = await loadRoute()
      const res = await GET(jsonRequest('/api/portal/billing-profile', { method: 'GET' }))
      await expectUnauthorized(res)
    })

    it('403 when artist not linked', async () => {
      resolvePortalArtistMock.mockResolvedValue(null)
      const { GET } = await loadRoute()
      const res = await GET(
        jsonRequest('/api/portal/billing-profile', {
          method: 'GET',
          bearer: 'tok',
          searchParams: { artist_id: TEST_ARTIST_ID },
        }),
      )
      await expectForbidden(res)
    })

    it('200 with profile payload', async () => {
      const { GET } = await loadRoute()
      const res = await GET(
        jsonRequest('/api/portal/billing-profile', {
          method: 'GET',
          bearer: 'tok',
          searchParams: { artist_id: TEST_ARTIST_ID },
        }),
      )
      const body = await expectOk<{ profile: unknown; isComplete: boolean }>(res, 200)
      expect(body.isComplete).toBe(true)
      expect(getBillingProfileMock).toHaveBeenCalled()
    })
  })

  describe('POST golden auth', () => {
    it('401 when membership helper rejects unauthenticated', async () => {
      withPortalMembershipMock.mockImplementation(() =>
        rejectApiError(401, 'Invalid or expired token'),
      )
      const { POST } = await loadRoute()
      const res = await POST(
        jsonRequest('/api/portal/billing-profile', {
          method: 'POST',
          body: validBody,
        }),
      )
      await expectUnauthorized(res)
    })

    it('403 when not a member', async () => {
      withPortalMembershipMock.mockImplementation(() =>
        rejectApiError(403, 'No artist linked to this account'),
      )
      const { POST } = await loadRoute()
      const res = await POST(
        jsonRequest('/api/portal/billing-profile', {
          method: 'POST',
          bearer: 'tok',
          body: validBody,
        }),
      )
      await expectForbidden(res)
    })

    it('200 upsert happy path', async () => {
      const { POST } = await loadRoute()
      const res = await POST(
        jsonRequest('/api/portal/billing-profile', {
          method: 'POST',
          bearer: 'tok',
          body: validBody,
        }),
      )
      const body = await expectOk<{ profile: { legalName: string }; isComplete: boolean }>(res, 200)
      expect(body.profile.legalName).toBe('Test Band GmbH')
      expect(portalMemberWriteMock).toHaveBeenCalled()
      expect(upsertBillingProfileMock).toHaveBeenCalled()
    })

    it('400 on invalid body', async () => {
      const { POST } = await loadRoute()
      const res = await POST(
        jsonRequest('/api/portal/billing-profile', {
          method: 'POST',
          bearer: 'tok',
          body: { artist_id: TEST_ARTIST_ID },
        }),
      )
      expect(res.status).toBe(400)
    })
  })
})
