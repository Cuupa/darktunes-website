import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest, readJson } from '../../helpers/api/routeTestkit'

const requireAdminFromRequestMock = vi.fn()
const createServiceRoleSupabaseClientMock = vi.fn()
const persistSosAnalyticsCoreMock = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  requireAdminFromRequest: (...args: unknown[]) => requireAdminFromRequestMock(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleSupabaseClient: (...args: unknown[]) =>
    createServiceRoleSupabaseClientMock(...args),
}))

vi.mock('@/lib/sos/persistSosAnalyticsCore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sos/persistSosAnalyticsCore')>()
  return {
    ...actual,
    persistSosAnalyticsCore: (...args: unknown[]) => persistSosAnalyticsCoreMock(...args),
  }
})

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/sos/persist-analytics/route')
}

const validBody = {
  periodStart: '2026-01',
  periodEnd: '2026-01',
  territoryMetrics: [],
}

describe('POST /api/admin/sos/persist-analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminFromRequestMock.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    createServiceRoleSupabaseClientMock.mockResolvedValue({ kind: 'service' })
    persistSosAnalyticsCoreMock.mockResolvedValue({ success: true, metricsUpserted: 1 })
  })

  it('returns 409 problem+json when the settlement period is locked', async () => {
    const { POST } = await loadRoute()
    const { SettlementPeriodNotWritableError } = await import('@/lib/api/settlementPeriods')
    persistSosAnalyticsCoreMock.mockRejectedValue(
      new SettlementPeriodNotWritableError('locked'),
    )

    const res = await POST(
      jsonRequest('/api/admin/sos/persist-analytics', {
        method: 'POST',
        bearer: 'tok',
        body: validBody,
      }),
    )

    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const { status, body } = await readJson<{ status?: number; detail?: string }>(res)
    expect(status).toBe(409)
    expect(body.status).toBe(409)
    expect(body.detail).toMatch(/locked/i)
  })

  it('returns 200 on a successful persist', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/admin/sos/persist-analytics', {
        method: 'POST',
        bearer: 'tok',
        body: validBody,
      }),
    )

    expect(res.status).toBe(200)
  })

  it('rejects a missing period before touching the service client', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      jsonRequest('/api/admin/sos/persist-analytics', {
        method: 'POST',
        bearer: 'tok',
        body: { territoryMetrics: [] },
      }),
    )

    expect(res.status).toBe(400)
    expect(persistSosAnalyticsCoreMock).not.toHaveBeenCalled()
  })
})
