/**
 * POST /api/admin/sos/settlement-repairs
 *
 * Builds a dry-run repair plan for uniquely repairable audit findings
 * (`dry_run` defaults to true, zero writes) or applies it idempotently with
 * `operation_id` and precondition checks. Locked/archived periods stay
 * immutable (except aligning the statement archive flag).
 */

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireAdminFromRequest } from '@/lib/adminAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, BusinessRuleError, withErrorHandler } from '@/lib/errors'
import { AUDIT_CATEGORIES, type AuditCategory } from '@/lib/api/settlementAuditCore'
import { scanSettlementAudit } from '@/lib/api/settlementAudit'
import { listSettlementPeriods } from '@/lib/api/settlementPeriods'
import {
  applySettlementRepairPlan,
  buildSettlementRepairPlan,
  findRepairStepsInLockedPeriods,
  type SettlementRepairApplyResult,
  type SettlementRepairPlan,
} from '@/lib/api/settlementRepair'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RepairRequestBody {
  period_id?: unknown
  categories?: unknown
  dry_run?: unknown
  operation_id?: unknown
}

function parseCategories(value: unknown): AuditCategory[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) throw new ApiError(400, 'categories must be an array')
  const unknown = value.filter(
    (entry) => typeof entry !== 'string' || !(AUDIT_CATEGORIES as readonly string[]).includes(entry),
  )
  if (unknown.length > 0) throw new ApiError(400, 'Unknown categories')
  return value as AuditCategory[]
}

function planToApi(plan: SettlementRepairPlan) {
  return {
    generated_at: plan.generatedAt,
    plan_hash: plan.planHash,
    scope: { period_id: plan.scope.periodId },
    steps: plan.steps.map((step) => ({
      id: step.id,
      action: step.action,
      entity_type: step.entityType,
      entity_id: step.entityId,
      summary: step.summary,
      expected_state: step.expectedState,
      new_state: step.newState,
    })),
    skipped: plan.skipped.map((entry) => ({
      finding_id: entry.findingId,
      category: entry.category,
      reason: entry.reason,
    })),
  }
}

function resultToApi(result: SettlementRepairApplyResult) {
  return {
    operation_id: result.operationId,
    plan_hash: result.planHash,
    dry_run: result.dryRun,
    status: result.status,
    applied_at: result.appliedAt,
    steps: result.steps.map((step) => ({
      step_id: step.stepId,
      action: step.action,
      entity_id: step.entityId,
      status: step.status,
      message: step.message ?? null,
    })),
    restore: {
      captured_at: result.restore.capturedAt,
      updates: result.restore.updates,
      inserts: result.restore.inserts,
    },
  }
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { userId } = await requireAdminFromRequest(req)

  const body = (await req.json()) as RepairRequestBody
  const periodId = typeof body.period_id === 'string' ? body.period_id : null
  if (periodId && !UUID_PATTERN.test(periodId)) {
    throw new ApiError(400, 'period_id must be a UUID')
  }
  const categories = parseCategories(body.categories)
  const dryRun = body.dry_run === undefined ? true : body.dry_run
  if (typeof dryRun !== 'boolean') throw new ApiError(400, 'dry_run must be a boolean')

  const operationId =
    typeof body.operation_id === 'string' && UUID_PATTERN.test(body.operation_id)
      ? body.operation_id
      : null
  if (body.operation_id !== undefined && !operationId) {
    throw new ApiError(400, 'operation_id must be a UUID')
  }
  if (!dryRun && !operationId) {
    throw new ApiError(400, 'operation_id is required when dry_run is false')
  }

  const db = await createServiceRoleSupabaseClient()
  const report = await scanSettlementAudit(db, { periodId, categories })
  const plan = buildSettlementRepairPlan(report)

  const periods = await listSettlementPeriods(db)
  const lockedSteps = findRepairStepsInLockedPeriods(plan, periods)
  if (lockedSteps.length > 0) {
    const labels = [...new Set(lockedSteps.map((step) => step.periodLabel))]
    throw new BusinessRuleError(
      `Repair blocked: ${lockedSteps.length} step(s) would modify locked or archived settlement periods (${labels.join(', ')}).`,
      409,
      'SETTLEMENT_PERIOD_LOCKED',
    )
  }

  const effectiveOperationId = operationId ?? randomUUID()
  const result = await applySettlementRepairPlan(db, plan, {
    actorId: userId,
    operationId: effectiveOperationId,
    dryRun,
  })

  const response = NextResponse.json(
    { plan: planToApi(plan), dry_run: dryRun, result: resultToApi(result) },
    { status: dryRun ? 200 : 201 },
  )
  if (!dryRun) {
    response.headers.set(
      'Location',
      `/api/admin/sos/settlement-repairs/${effectiveOperationId}`,
    )
  }
  return response
})
