/**
 * Dry-run repair plan and idempotent application for the SOS settlement audit
 * (§E.3). Only findings with a proven unique mapping become steps; ambiguous or
 * non-repairable cases stay manual. Application stops at the first changed
 * precondition, is audited per entity and journals a restore artifact.
 */

import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { BusinessRuleError } from '@/lib/errors'
import { appendLedgerEntry } from '@/lib/api/settlementLedger'
import { isPeriodWritable, type SettlementPeriodStatus } from '@/lib/api/settlementPeriods'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import {
  completeSettlementOperation,
  getSettlementOperationById,
  insertSettlementOperation,
} from '@/lib/api/settlementOperations'
import type {
  AuditEvidenceValue,
  AuditRepairability,
  SettlementAuditReport,
} from '@/lib/api/settlementAuditCore'

type DbClient = SupabaseClient<Database>

export const REPAIR_OPERATION_TYPE = 'settlement_repair'
export const REPAIR_RESOURCE_TYPE = 'settlement_period'

export type RepairAction =
  | 'link_statement_period'
  | 'link_invoice_period'
  | 'archive_statements'
  | 'insert_carry_in_ledger'

export interface RepairStep {
  id: string
  action: RepairAction
  entityType: string
  entityId: string
  summary: string
  expectedState: Record<string, AuditEvidenceValue>
  newState: Record<string, AuditEvidenceValue>
}

export interface SkippedFinding {
  findingId: string
  category: string
  reason: AuditRepairability
}

export interface SettlementRepairPlan {
  generatedAt: string
  planHash: string
  scope: { periodId: string | null }
  steps: RepairStep[]
  skipped: SkippedFinding[]
}

export interface RepairStepResult {
  stepId: string
  action: RepairAction
  entityId: string
  status: 'applied' | 'skipped' | 'conflict' | 'failed' | 'ready'
  message?: string
}

export interface RepairRestoreArtifact {
  capturedAt: string
  updates: Array<{ table: string; id: string; before: Record<string, unknown> }>
  inserts: Array<{ table: string; id: string }>
}

export interface SettlementRepairApplyResult {
  operationId: string
  planHash: string
  dryRun: boolean
  status: 'ready' | 'conflict' | 'failed'
  appliedAt: string
  steps: RepairStepResult[]
  restore: RepairRestoreArtifact
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Deterministic UUID for unscoped runs so `settlement_operations.resource_id` stays stable. */
export function repairResourceIdForPlan(plan: SettlementRepairPlan): string {
  if (plan.scope.periodId) return plan.scope.periodId
  const hex = plan.planHash.slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function stepFromFinding(
  finding: SettlementAuditReport['findings'][number],
): RepairStep | null {
  if (finding.repairability !== 'unique' || !finding.expectedState) return null

  if (finding.category === 'period_link' && finding.entityType === 'sales_statement') {
    if ('settlement_period_id' in finding.expectedState) {
      return {
        id: finding.id,
        action: 'link_statement_period',
        entityType: finding.entityType,
        entityId: finding.entityId,
        summary: finding.summary,
        expectedState: { settlement_period_id: finding.evidence.settlement_period_id ?? null },
        newState: { settlement_period_id: finding.expectedState.settlement_period_id },
      }
    }
    if (finding.expectedState.is_archived === true) {
      return {
        id: finding.id,
        action: 'archive_statements',
        entityType: finding.entityType,
        entityId: finding.entityId,
        summary: finding.summary,
        expectedState: { is_archived: false },
        newState: { is_archived: true },
      }
    }
    return null
  }

  if (finding.category === 'period_link' && finding.entityType === 'artist_invoice') {
    if (!('settlement_period_id' in finding.expectedState)) return null
    return {
      id: finding.id,
      action: 'link_invoice_period',
      entityType: finding.entityType,
      entityId: finding.entityId,
      summary: finding.summary,
      expectedState: { settlement_period_id: finding.evidence.settlement_period_id ?? null },
      newState: { settlement_period_id: finding.expectedState.settlement_period_id },
    }
  }

  if (
    finding.category === 'carry_forward_integrity' &&
    finding.entityType === 'period_carry_forward'
  ) {
    return {
      id: finding.id,
      action: 'insert_carry_in_ledger',
      entityType: finding.entityType,
      entityId: finding.entityId,
      summary: finding.summary,
      expectedState: finding.expectedState,
      newState: { ledger_entry_type: 'carry_in' },
    }
  }

  return null
}

export function buildSettlementRepairPlan(report: SettlementAuditReport): SettlementRepairPlan {  const steps: RepairStep[] = []
  const skipped: SkippedFinding[] = []

  for (const finding of report.findings) {
    const step = stepFromFinding(finding)
    if (step) {
      steps.push(step)
    } else {
      skipped.push({
        findingId: finding.id,
        category: finding.category,
        reason: finding.repairability === 'unique' ? 'not_repairable' : finding.repairability,
      })
    }
  }

  steps.sort((a, b) => a.id.localeCompare(b.id))

  const planHash = sha256(
    JSON.stringify(
      steps.map((step) => ({
        id: step.id,
        action: step.action,
        entityType: step.entityType,
        entityId: step.entityId,
        expectedState: step.expectedState,
        newState: step.newState,
      })),
    ),
  )

  return {
    generatedAt: report.generatedAt,
    planHash,
    scope: { periodId: report.scope.periodId },
    steps,
    skipped,
  }
}

export interface RepairPeriodLock {
  id: string
  label: string
  status: string
}

export interface LockedRepairStep {
  stepId: string
  action: RepairAction
  periodId: string
  periodLabel: string
  periodStatus: string
}

/**
 * Repair steps that would mutate a locked or archived period. `archive_statements`
 * is exempt: it only aligns the flag with an already archived period.
 */
export function findRepairStepsInLockedPeriods(
  plan: SettlementRepairPlan,
  periods: RepairPeriodLock[],
): LockedRepairStep[] {
  const periodById = new Map(periods.map((period) => [period.id, period]))
  const locked: LockedRepairStep[] = []

  for (const step of plan.steps) {
    if (step.action === 'archive_statements') continue
    const periodId =
      step.action === 'insert_carry_in_ledger'
        ? String(step.expectedState.settlement_period_id ?? '')
        : String(step.newState.settlement_period_id ?? '')
    const period = periodById.get(periodId)
    if (!period) continue
    if (isPeriodWritable(period.status as SettlementPeriodStatus)) continue
    locked.push({
      stepId: step.id,
      action: step.action,
      periodId: period.id,
      periodLabel: period.label,
      periodStatus: period.status,
    })
  }

  return locked
}

interface RowRead {
  row: Record<string, unknown> | null
  error: string | null
}

async function readRow(
  db: DbClient,
  table: 'sales_statements' | 'artist_invoices',
  id: string,
): Promise<RowRead> {
  const { data, error } = await db.from(table).select('*').eq('id', id).maybeSingle()
  if (error) return { row: null, error: error.message }
  return { row: (data as Record<string, unknown> | null) ?? null, error: null }
}

async function hasCarryInEntry(
  db: DbClient,
  settlementPeriodId: string,
  artistId: string,
  referenceId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('artist_settlement_ledger')
    .select('id')
    .eq('entry_type', 'carry_in')
    .eq('settlement_period_id', settlementPeriodId)
    .eq('artist_id', artistId)
    .eq('reference_type', 'settlement_period')
    .eq('reference_id', referenceId)
    .limit(1)

  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

function conflictMessage(expected: AuditEvidenceValue, actual: unknown): string {
  return `Precondition changed: expected ${String(expected)}, found ${actual === null ? 'null' : String(actual)}`
}

export async function applySettlementRepairPlan(
  db: DbClient,
  plan: SettlementRepairPlan,
  options: { actorId: string; operationId: string; dryRun: boolean },
): Promise<SettlementRepairApplyResult> {
  const { actorId, operationId, dryRun } = options
  const appliedAt = new Date().toISOString()
  const restore: RepairRestoreArtifact = { capturedAt: appliedAt, updates: [], inserts: [] }
  const stepResults: RepairStepResult[] = []

  if (!dryRun) {
    const existing = await getSettlementOperationById(db, operationId)
    if (existing) {
      if (existing.payloadHash !== plan.planHash) {
        throw new BusinessRuleError(
          'operation_id was already used with a different repair plan',
          409,
          'REPAIR_OPERATION_CONFLICT',
        )
      }
      if (existing.status === 'ready') {
        return existing.result as unknown as SettlementRepairApplyResult
      }
    } else {
      const claimed = await insertSettlementOperation(db, {
        id: operationId,
        operationType: REPAIR_OPERATION_TYPE,
        resourceType: REPAIR_RESOURCE_TYPE,
        resourceId: repairResourceIdForPlan(plan),
        actorId,
        payloadHash: plan.planHash,
      })
      if (!claimed) {
        const raced = await getSettlementOperationById(db, operationId)
        if (raced && raced.payloadHash !== plan.planHash) {
          throw new BusinessRuleError(
            'operation_id was already used with a different repair plan',
            409,
            'REPAIR_OPERATION_CONFLICT',
          )
        }
        if (raced?.status === 'ready') {
          return raced.result as unknown as SettlementRepairApplyResult
        }
      }
    }
  }

  let stopped = false
  for (const step of plan.steps) {
    if (stopped) {
      stepResults.push({
        stepId: step.id,
        action: step.action,
        entityId: step.entityId,
        status: 'skipped',
        message: 'Stopped after an earlier precondition conflict',
      })
      continue
    }

    try {
      if (step.action === 'link_statement_period' || step.action === 'link_invoice_period') {
        const table = step.action === 'link_statement_period' ? 'sales_statements' : 'artist_invoices'
        const { row, error } = await readRow(db, table, step.entityId)
        if (error) {
          stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'failed', message: error })
          stopped = true
          continue
        }
        if (!row) {
          stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'conflict', message: 'Row no longer exists' })
          stopped = true
          continue
        }
        const current = row.settlement_period_id ?? null
        if (current === step.newState.settlement_period_id) {
          stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'skipped', message: 'Already linked' })
          continue
        }
        if (current !== step.expectedState.settlement_period_id) {
          stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'conflict', message: conflictMessage(step.expectedState.settlement_period_id, current) })
          stopped = true
          continue
        }

        if (!dryRun) {
          const { error: updateError } = await db
            .from(table)
            .update({ settlement_period_id: String(step.newState.settlement_period_id) })
            .eq('id', step.entityId)
          if (updateError) {
            stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'failed', message: updateError.message })
            stopped = true
            continue
          }
          restore.updates.push({ table, id: step.entityId, before: row })
          await logFinancialEvent(db, {
            entityType: table === 'sales_statements' ? 'sales_statement' : 'artist_invoice',
            entityId: step.entityId,
            action: 'repair_period_link',
            actorId,
            beforeData: { settlement_period_id: current },
            afterData: { settlement_period_id: step.newState.settlement_period_id },
          })
        }

        stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: dryRun ? 'ready' : 'applied' })
        continue
      }

      if (step.action === 'archive_statements') {
        const { row, error } = await readRow(db, 'sales_statements', step.entityId)
        if (error || !row) {
          stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: error ? 'failed' : 'conflict', message: error ?? 'Row no longer exists' })
          stopped = true
          continue
        }
        if (row.is_archived === true) {
          stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'skipped', message: 'Already archived' })
          continue
        }
        if (row.is_archived !== false) {
          stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'conflict', message: conflictMessage(false, row.is_archived) })
          stopped = true
          continue
        }

        if (!dryRun) {
          const { error: updateError } = await db
            .from('sales_statements')
            .update({ is_archived: true })
            .eq('id', step.entityId)
          if (updateError) {
            stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'failed', message: updateError.message })
            stopped = true
            continue
          }
          restore.updates.push({ table: 'sales_statements', id: step.entityId, before: row })
          await logFinancialEvent(db, {
            entityType: 'sales_statement',
            entityId: step.entityId,
            action: 'repair_archive_flag',
            actorId,
            beforeData: { is_archived: false },
            afterData: { is_archived: true },
          })
        }

        stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: dryRun ? 'ready' : 'applied' })
        continue
      }

      const settlementPeriodId = String(step.expectedState.settlement_period_id ?? '')
      const artistId = String(step.expectedState.artist_id ?? '')
      const referenceId = String(step.expectedState.reference_id ?? '')
      const amountEur = Number(step.expectedState.amount_eur ?? 0)

      const alreadyApplied = await hasCarryInEntry(db, settlementPeriodId, artistId, referenceId)
      if (alreadyApplied) {
        stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'skipped', message: 'carry_in already exists' })
        continue
      }

      if (dryRun) {
        stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'ready' })
        continue
      }

      const entry = await appendLedgerEntry(db, {
        artistId,
        settlementPeriodId,
        entryType: 'carry_in',
        amountEur,
        referenceType: 'settlement_period',
        referenceId,
        description: `Repair carry_in for applied carry-forward ${step.entityId}`,
        createdBy: actorId,
      })
      restore.inserts.push({ table: 'artist_settlement_ledger', id: entry.id })
      await logFinancialEvent(db, {
        entityType: 'artist_settlement_ledger',
        entityId: entry.id,
        action: 'repair_carry_in',
        actorId,
        afterData: { settlement_period_id: settlementPeriodId, artist_id: artistId, amount_eur: amountEur },
      })
      stepResults.push({ stepId: step.id, action: step.action, entityId: step.entityId, status: 'applied' })
    } catch (err) {
      stepResults.push({
        stepId: step.id,
        action: step.action,
        entityId: step.entityId,
        status: 'failed',
        message: err instanceof Error ? err.message : 'Unknown repair error',
      })
      stopped = true
    }
  }

  const status: SettlementRepairApplyResult['status'] = stepResults.some(
    (result) => result.status === 'failed',
  )
    ? 'failed'
    : stepResults.some((result) => result.status === 'conflict')
      ? 'conflict'
      : 'ready'

  const result: SettlementRepairApplyResult = {
    operationId,
    planHash: plan.planHash,
    dryRun,
    status,
    appliedAt,
    steps: stepResults,
    restore,
  }

  if (!dryRun) {
    await completeSettlementOperation(db, operationId, result as unknown as Record<string, unknown>)
  }

  return result
}
