import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest, readJson } from '../../helpers/api/routeTestkit'
import type { AuditFinding, SettlementAuditReport } from '@/lib/api/settlementAuditCore'

const requireAdminFromRequestMock = vi.fn()
const createServiceRoleSupabaseClientMock = vi.fn()
const scanSettlementAuditMock = vi.fn()

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

function makeFinding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    id: 'period_link:sales_statement:statement-1',
    category: 'period_link',
    severity: 'warning',
    entityType: 'sales_statement',
    entityId: 'statement-1',
    summary: 'Statement has no settlement period link',
    evidence: { status: 'approved' },
    expectedState: { settlement_period_id: 'period-1' },
    suggestedAction: 'Link the period',
    repairability: 'unique',
    ...overrides,
  }
}

function makeReport(findings: AuditFinding[]): SettlementAuditReport {
  return {
    generatedAt: '2026-09-17T00:00:00.000Z',
    scope: { periodId: null },
    truncated: false,
    summary: {
      findings: findings.length,
      byCategory: {
        period_link: findings.length,
        artist_mismatch: 0,
        invoice_without_pdf: 0,
        pdf_without_record: 0,
        unconfirmed_import_batch: 0,
        artifact_integrity: 0,
        duplicate_operation: 0,
        carry_forward_integrity: 0,
        balance_mismatch: 0,
        missing_evidence: 0,
      },
      bySeverity: { error: 0, warning: findings.length, info: 0 },
      byRepairability: { unique: findings.length, ambiguous: 0, not_repairable: 0 },
    },
    findings,
  }
}

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/sos/settlement-audits/route')
}

interface AuditApiBody {
  generated_at?: string
  findings?: Array<{ id: string; entity_type: string; expected_state: Record<string, unknown> | null }>
  next_cursor?: string | null
  summary?: { findings: number }
}

describe('GET /api/admin/sos/settlement-audits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminFromRequestMock.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    createServiceRoleSupabaseClientMock.mockResolvedValue({ kind: 'service' })
    scanSettlementAuditMock.mockResolvedValue(makeReport([makeFinding()]))
  })

  it('returns 401 when the admin check fails', async () => {
    const { GET } = await loadRoute()
    const { ApiError } = await import('@/lib/errors')
    requireAdminFromRequestMock.mockRejectedValue(new ApiError(401, 'Missing bearer token'))

    const res = await GET(jsonRequest('/api/admin/sos/settlement-audits'))

    expect(res.status).toBe(401)
    expect(scanSettlementAuditMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid period id', async () => {
    const { GET } = await loadRoute()
    const res = await GET(
      jsonRequest('/api/admin/sos/settlement-audits', {
        searchParams: { period_id: 'not-a-uuid' },
      }),
    )

    expect(res.status).toBe(400)
    expect(scanSettlementAuditMock).not.toHaveBeenCalled()
  })

  it('rejects unknown categories and invalid cursors', async () => {
    const { GET } = await loadRoute()
    const categoryRes = await GET(
      jsonRequest('/api/admin/sos/settlement-audits', {
        searchParams: { categories: 'period_link,not_a_category' },
      }),
    )
    expect(categoryRes.status).toBe(400)

    const cursorRes = await GET(
      jsonRequest('/api/admin/sos/settlement-audits', {
        searchParams: { cursor: 'not-a-cursor' },
      }),
    )
    expect(cursorRes.status).toBe(400)
  })

  it('returns the report in snake_case with an opaque cursor', async () => {
    const { GET } = await loadRoute()
    const findings = [
      makeFinding({ id: 'a' }),
      makeFinding({ id: 'b' }),
      makeFinding({ id: 'c' }),
    ]
    scanSettlementAuditMock.mockResolvedValue(makeReport(findings))

    const first = await GET(
      jsonRequest('/api/admin/sos/settlement-audits', {
        searchParams: { limit: '2', categories: 'period_link' },
      }),
    )
    const firstBody = await readJson<AuditApiBody>(first)
    expect(first.status).toBe(200)
    expect(firstBody.body.findings?.map((finding) => finding.id)).toEqual(['a', 'b'])
    expect(firstBody.body.findings?.[0].entity_type).toBe('sales_statement')
    expect(firstBody.body.findings?.[0].expected_state).toEqual({
      settlement_period_id: 'period-1',
    })
    expect(firstBody.body.next_cursor).toBeTruthy()
    expect(scanSettlementAuditMock).toHaveBeenCalledWith(expect.anything(), {
      periodId: null,
      categories: ['period_link'],
    })

    const second = await GET(
      jsonRequest('/api/admin/sos/settlement-audits', {
        searchParams: { limit: '2', cursor: firstBody.body.next_cursor ?? '' },
      }),
    )
    const secondBody = await readJson<AuditApiBody>(second)
    expect(secondBody.body.findings?.map((finding) => finding.id)).toEqual(['c'])
    expect(secondBody.body.next_cursor).toBeNull()
  })

  it('passes the period scope to the scan', async () => {
    const { GET } = await loadRoute()
    const periodId = '11111111-1111-4111-8111-111111111111'

    await GET(
      jsonRequest('/api/admin/sos/settlement-audits', {
        searchParams: { period_id: periodId },
      }),
    )

    expect(scanSettlementAuditMock).toHaveBeenCalledWith(expect.anything(), {
      periodId,
      categories: undefined,
    })
  })
})
