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

export interface SettlementRepairStepApi {
  id: string
  action:
    | 'link_statement_period'
    | 'link_invoice_period'
    | 'archive_statements'
    | 'insert_carry_in_ledger'
  entity_type: string
  entity_id: string
  summary: string
  expected_state: Record<string, string | number | boolean | null>
  new_state: Record<string, string | number | boolean | null>
}

export interface SettlementRepairPlanApi {
  generated_at: string
  plan_hash: string
  scope: { period_id: string | null }
  steps: SettlementRepairStepApi[]
  skipped: Array<{ finding_id: string; category: string; reason: string }>
}

export interface SettlementRepairResultApi {
  operation_id: string
  plan_hash: string
  dry_run: boolean
  status: 'ready' | 'conflict' | 'failed'
  applied_at: string
  steps: Array<{
    step_id: string
    action: string
    entity_id: string
    status: 'applied' | 'skipped' | 'conflict' | 'failed' | 'ready'
    message: string | null
  }>
  restore: {
    captured_at: string
    updates: Array<{ table: string; id: string; before: Record<string, unknown> }>
    inserts: Array<{ table: string; id: string }>
  }
}

export interface SettlementRepairResponseApi {
  plan: SettlementRepairPlanApi
  dry_run: boolean
  result: SettlementRepairResultApi
}

async function postRepair(
  token: string,
  body: { periodId?: string; categories?: string[]; dryRun: boolean; operationId?: string },
  fallbackError: string,
): Promise<SettlementRepairResponseApi> {
  const response = await fetch('/api/admin/sos/settlement-repairs', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      period_id: body.periodId,
      categories: body.categories,
      dry_run: body.dryRun,
      operation_id: body.operationId,
    }),
  })
  if (!response.ok) throw await readError(response, fallbackError)
  return (await response.json()) as SettlementRepairResponseApi
}

export function dryRunSettlementRepair(
  token: string,
  params: { periodId?: string; categories?: string[] },
  fallbackError: string,
): Promise<SettlementRepairResponseApi> {
  return postRepair(token, { ...params, dryRun: true }, fallbackError)
}

export function applySettlementRepair(
  token: string,
  params: { periodId?: string; categories?: string[]; operationId: string },
  fallbackError: string,
): Promise<SettlementRepairResponseApi> {
  return postRepair(
    token,
    { periodId: params.periodId, categories: params.categories, dryRun: false, operationId: params.operationId },
    fallbackError,
  )
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
