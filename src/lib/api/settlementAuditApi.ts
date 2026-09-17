/**
 * Client-side fetch helpers for the read-only settlement data audit.
 */

import type {
  AuditCategory,
  AuditRepairability,
  AuditSeverity,
} from '@/lib/api/settlementAuditCore'

export interface SettlementAuditFindingApi {
  id: string
  category: AuditCategory
  severity: AuditSeverity
  entity_type: string
  entity_id: string
  summary: string
  evidence: Record<string, string | number | boolean | null>
  expected_state: Record<string, string | number | boolean | null> | null
  suggested_action: string
  repairability: AuditRepairability
}

export interface SettlementAuditResponseApi {
  generated_at: string
  scope: { period_id: string | null }
  truncated: boolean
  summary: {
    findings: number
    by_category: Record<string, number>
    by_severity: Record<string, number>
    by_repairability: Record<string, number>
  }
  findings: SettlementAuditFindingApi[]
  next_cursor: string | null
}

export interface SettlementAuditPeriodApi {
  id: string
  label: string
  status: string
}

export class SettlementAuditApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'SettlementAuditApiError'
  }
}

async function readError(response: Response, fallback: string): Promise<SettlementAuditApiError> {
  const json = (await response.json().catch(() => null)) as { error?: unknown } | null
  const message =
    json && typeof json.error === 'string' && json.error.length > 0 ? json.error : fallback
  return new SettlementAuditApiError(message, response.status)
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

export async function fetchSettlementAudit(
  token: string,
  params: {
    periodId?: string
    categories?: string[]
    limit?: number
    cursor?: string
  },
  fallbackError: string,
): Promise<SettlementAuditResponseApi> {
  const search = new URLSearchParams()
  if (params.periodId) search.set('period_id', params.periodId)
  if (params.categories && params.categories.length > 0) {
    search.set('categories', params.categories.join(','))
  }
  if (params.limit) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)

  const response = await fetch(`/api/admin/sos/settlement-audits?${search.toString()}`, {
    headers: authHeaders(token),
  })
  if (!response.ok) throw await readError(response, fallbackError)
  return (await response.json()) as SettlementAuditResponseApi
}

export async function fetchSettlementPeriodsForAudit(
  token: string,
  fallbackError: string,
): Promise<SettlementAuditPeriodApi[]> {
  const response = await fetch('/api/admin/settlements/periods', {
    headers: authHeaders(token),
  })
  if (!response.ok) throw await readError(response, fallbackError)
  const json = (await response.json()) as { periods?: SettlementAuditPeriodApi[] }
  return json.periods ?? []
}
