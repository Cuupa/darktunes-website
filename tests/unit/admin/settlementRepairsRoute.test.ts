import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest, readJson } from '../../helpers/api/routeTestkit'
import { buildSettlementAuditReport } from '@/lib/api/settlementAuditCore'

const requireAdminFromRequestMock = vi.fn()
const createServiceRoleSupabaseClientMock = vi.fn()
const scanSettlementAuditMock = vi.fn()
const listSettlementPeriodsMock = vi.fn()
const applySettlementRepairPlanMock = vi.fn()
const getSettlementOperationByIdMock = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  requireAdminFromRequest: (...args: unknown[]) => requireAdminFromRequestMock(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleSupabaseClient: (...args: unknown[]) =>
    createServiceRoleSupabaseClientMock(...args),
}))

vi.mock('@/lib/api/settlementAudit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/settlementAudit')>()
  return {
    ...actual,
    scanSettlementAudit: (...args: unknown[]) => scanSettlementAuditMock(...args),
  }
})

vi.mock('@/lib/api/settlementPeriods', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/settlementPeriods')>()
  return {
    ...actual,
    listSettlementPeriods: (...args: unknown[]) => listSettlementPeriodsMock(...args),
  }
})

vi.mock('@/lib/api/settlementRepair', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/settlementRepair')>()
  return {
    ...actual,
    applySettlementRepairPlan: (...args: unknown[]) => applySettlementRepairPlanMock(...args),
  }
})

vi.mock('@/lib/api/settlementOperations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/settlementOperations')>()
  return {
    ...actual,
    getSettlementOperationById: (...args: unknown[]) => getSettlementOperationByIdMock(...args),
  }
})

const PERIOD_ID = '11111111-1111-4111-8111-111111111111'
const OPERATION_ID = '99999999-9999-4999-8999-999999999999'

function makeReport() {
  return buildSettlementAuditReport({
    periods: [
      {
        id: PERIOD_ID,
        label: '2025-10-01 – 2026-03-31',
        periodStart: '2025-10-01',
        periodEnd: '2026-03-31',
        status: 'open',
      },
    ],
    statements: [
      {
        id: 'statement-1',
        artistId: 'artist-1',
        settlementPeriodId: null,
        periodStart: '2025-10-01',
        periodEnd: '2026-03-31',
        status: 'approved',
        isArchived: false,
        amountEur: 100,
        firstViewedAt: null,
        createdAt: '2025-11-01T00:00:00.000Z',
      },
    ],
    invoices: [],
    ledgerEntries: [],
    carryForwards: [],
    importBatches: [],
    operations: [],
    generatedAt: '2026-09-17T00:00:00.000Z',
    scopePeriodId: PERIOD_ID,
  })
}

async function loadPostRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/sos/settlement-repairs/route')
}

async function loadGetRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/sos/settlement-repairs/[operation_id]/route')
}

describe('POST /api/admin/sos/settlement-repairs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminFromRequestMock.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    createServiceRoleSupabaseClientMock.mockResolvedValue({ kind: 'service' })
    scanSettlementAuditMock.mockResolvedValue(makeReport())
    listSettlementPeriodsMock.mockResolvedValue([
      {
        id: PERIOD_ID,
        label: '2025-10-01 – 2026-03-31',
        periodStart: '2025-10-01',
        periodEnd: '2026-03-31',
        status: 'open',
      },
    ])
    applySettlementRepairPlanMock.mockImplementation(async (_db, plan, options) => ({
      operationId: options.operationId,
      planHash: plan.planHash,
      dryRun: options.dryRun,
      status: 'ready',
      appliedAt: '2026-09-17T00:00:00.000Z',
      steps: plan.steps.map((step: { id: string; action: string; entityId: string }) => ({
        stepId: step.id,
        action: step.action,
        entityId: step.entityId,
        status: options.dryRun ? 'ready' : 'applied',
      })),
      restore: { capturedAt: '2026-09-17T00:00:00.000Z', updates: [], inserts: [] },
    }))
  })

  it('defaults to a dry run and returns the plan with a generated operation id', async () => {
    const { POST } = await loadPostRoute()
    const res = await POST(
      jsonRequest('/api/admin/sos/settlement-repairs', {
        method: 'POST',
        bearer: 'tok',
        body: { period_id: PERIOD_ID },
      }),
    )
    const { status, body } = await readJson<{
      dry_run?: boolean
      plan?: { steps?: unknown[] }
      result?: { operation_id?: string; dry_run?: boolean }
    }>(res)

    expect(status).toBe(200)
    expect(body.dry_run).toBe(true)
    expect(body.plan?.steps).toHaveLength(1)
    expect(body.result?.operation_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(applySettlementRepairPlanMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ dryRun: true, actorId: 'admin-1' }),
    )
  })

  it('requires an operation id for an apply run', async () => {
    const { POST } = await loadPostRoute()
    const res = await POST(
      jsonRequest('/api/admin/sos/settlement-repairs', {
        method: 'POST',
        bearer: 'tok',
        body: { dry_run: false },
      }),
    )

    expect(res.status).toBe(400)
    expect(applySettlementRepairPlanMock).not.toHaveBeenCalled()
  })

  it('returns 201 with a Location header for an applied run', async () => {
    const { POST } = await loadPostRoute()
    const res = await POST(
      jsonRequest('/api/admin/sos/settlement-repairs', {
        method: 'POST',
        bearer: 'tok',
        body: { dry_run: false, operation_id: OPERATION_ID },
      }),
    )

    expect(res.status).toBe(201)
    expect(res.headers.get('location')).toBe(
      `/api/admin/sos/settlement-repairs/${OPERATION_ID}`,
    )
    expect(applySettlementRepairPlanMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ dryRun: false, operationId: OPERATION_ID }),
    )
  })

  it('blocks steps that would mutate a locked period', async () => {
    listSettlementPeriodsMock.mockResolvedValue([
      {
        id: PERIOD_ID,
        label: '2025-10-01 – 2026-03-31',
        periodStart: '2025-10-01',
        periodEnd: '2026-03-31',
        status: 'locked',
      },
    ])

    const { POST } = await loadPostRoute()
    const res = await POST(
      jsonRequest('/api/admin/sos/settlement-repairs', {
        method: 'POST',
        bearer: 'tok',
        body: { period_id: PERIOD_ID },
      }),
    )
    const { status, body } = await readJson<{ code?: string }>(res)

    expect(status).toBe(409)
    expect(body.code).toBe('SETTLEMENT_PERIOD_LOCKED')
    expect(applySettlementRepairPlanMock).not.toHaveBeenCalled()
  })

  it('rejects invalid categories and period ids', async () => {
    const { POST } = await loadPostRoute()
    const badCategory = await POST(
      jsonRequest('/api/admin/sos/settlement-repairs', {
        method: 'POST',
        bearer: 'tok',
        body: { categories: ['nope'] },
      }),
    )
    expect(badCategory.status).toBe(400)

    const badPeriod = await POST(
      jsonRequest('/api/admin/sos/settlement-repairs', {
        method: 'POST',
        bearer: 'tok',
        body: { period_id: 'nope' },
      }),
    )
    expect(badPeriod.status).toBe(400)
  })
})

describe('GET /api/admin/sos/settlement-repairs/{operation_id}', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminFromRequestMock.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    createServiceRoleSupabaseClientMock.mockResolvedValue({ kind: 'service' })
  })

  it('returns the stored run', async () => {
    getSettlementOperationByIdMock.mockResolvedValue({
      id: OPERATION_ID,
      operationType: 'settlement_repair',
      payloadHash: 'hash',
      status: 'ready',
      result: { status: 'ready' },
      createdAt: '2026-09-17T00:00:00.000Z',
      updatedAt: '2026-09-17T00:00:00.000Z',
    })

    const { GET } = await loadGetRoute()
    const res = await GET(
      jsonRequest(`/api/admin/sos/settlement-repairs/${OPERATION_ID}`, { bearer: 'tok' }),
    )
    const { status, body } = await readJson<{ operation_id?: string; plan_hash?: string }>(res)

    expect(status).toBe(200)
    expect(body.operation_id).toBe(OPERATION_ID)
    expect(body.plan_hash).toBe('hash')
  })

  it('returns 404 for unknown or non-repair operations', async () => {
    getSettlementOperationByIdMock.mockResolvedValue(null)

    const { GET } = await loadGetRoute()
    const res = await GET(
      jsonRequest(`/api/admin/sos/settlement-repairs/${OPERATION_ID}`, { bearer: 'tok' }),
    )

    expect(res.status).toBe(404)
  })
})
