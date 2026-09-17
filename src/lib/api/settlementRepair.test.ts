import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { BusinessRuleError } from '@/lib/errors'
import { buildSettlementAuditReport } from '@/lib/api/settlementAuditCore'
import {
  applySettlementRepairPlan,
  buildSettlementRepairPlan,
  repairResourceIdForPlan,
} from './settlementRepair'

type DbClient = SupabaseClient<Database>

interface FakeState {
  sales_statements: Array<Record<string, unknown>>
  artist_invoices: Array<Record<string, unknown>>
  artist_settlement_ledger: Array<Record<string, unknown>>
  settlement_operations: Array<Record<string, unknown>>
  financial_audit_events: Array<Record<string, unknown>>
}

function makeFakeDb(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    sales_statements: [],
    artist_invoices: [],
    artist_settlement_ledger: [],
    settlement_operations: [],
    financial_audit_events: [],
    ...initial,
  }
  const writes: Array<{ table: string; op: 'update' | 'insert'; payload: Record<string, unknown> }> = []
  let idCounter = 0

  const from = vi.fn((table: string) => {
    const rows = () => state[table as keyof FakeState]

    const makeBuilder = (
      op: 'select' | 'update' | 'insert',
      payload?: Record<string, unknown>,
    ) => {
      const filters: Array<[string, unknown]> = []
      let wantsSingle = false
      const match = () => rows().filter((row) => filters.every(([col, value]) => row[col] === value))

      const execute = async (): Promise<{ data: unknown; error: null }> => {
        if (op === 'select') {
          const found = match()
          return { data: wantsSingle ? (found[0] ?? null) : found, error: null }
        }
        if (op === 'update') {
          writes.push({ table, op, payload: payload ?? {} })
          const target = rows()
          for (let index = 0; index < target.length; index += 1) {
            if (filters.every(([col, value]) => target[index][col] === value)) {
              target[index] = { ...target[index], ...payload }
            }
          }
          return { data: null, error: null }
        }
        const record = { id: `${table}-${++idCounter}`, ...payload }
        writes.push({ table, op, payload: payload ?? {} })
        rows().push(record)
        return { data: record, error: null }
      }

      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, value: unknown) => {
          filters.push([col, value])
          return builder
        },
        limit: () => execute(),
        maybeSingle: () => {
          wantsSingle = true
          return execute()
        },
        single: () => {
          wantsSingle = true
          return execute()
        },
        then: (resolve: (value: unknown) => unknown) => execute().then(resolve),
      }
      return builder
    }

    return {
      select: () => makeBuilder('select'),
      update: (payload: Record<string, unknown>) => makeBuilder('update', payload),
      insert: (payload: Record<string, unknown>) => makeBuilder('insert', payload),
    }
  })

  return { db: { from } as unknown as DbClient, state, writes }
}

const periodId = '11111111-1111-4111-8111-111111111111'
const artistId = '33333333-3333-4333-8333-333333333333'

function auditInputWithMissingLink() {
  return {
    periods: [
      {
        id: periodId,
        label: '2025-10-01 – 2026-03-31',
        periodStart: '2025-10-01',
        periodEnd: '2026-03-31',
        status: 'open',
      },
    ],
    statements: [
      {
        id: 'statement-1',
        artistId,
        settlementPeriodId: null,
        periodStart: '2025-10-01',
        periodEnd: '2026-03-31',
        status: 'approved',
        isArchived: false,
        amountEur: 100,
        firstViewedAt: '2025-11-01T00:00:00.000Z',
        createdAt: '2025-11-01T00:00:00.000Z',
      },
    ],
    invoices: [],
    ledgerEntries: [],
    carryForwards: [],
    importBatches: [],
    operations: [],
    generatedAt: '2026-09-17T00:00:00.000Z',
    scopePeriodId: periodId,
  }
}

function auditInputWithMissingCarryIn() {
  return {
    ...auditInputWithMissingLink(),
    statements: [],
    carryForwards: [
      {
        id: 'carry-1',
        fromPeriodId: 'period-0',
        toPeriodId: periodId,
        artistId,
        openingBalanceEur: 20,
        appliedAt: '2025-10-01T00:00:00.000Z',
        createdAt: '2025-10-01T00:00:00.000Z',
      },
    ],
  }
}

describe('buildSettlementRepairPlan', () => {
  it('turns a uniquely repairable period link into a step and skips the rest', () => {
    const report = buildSettlementAuditReport(auditInputWithMissingLink())
    const plan = buildSettlementRepairPlan(report)

    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]).toMatchObject({
      action: 'link_statement_period',
      entityId: 'statement-1',
      expectedState: { settlement_period_id: null },
      newState: { settlement_period_id: periodId },
    })
    expect(plan.skipped).toEqual([])
    expect(plan.planHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('keeps ambiguous findings out of the plan', () => {
    const report = buildSettlementAuditReport({
      ...auditInputWithMissingLink(),
      statements: [
        {
          ...auditInputWithMissingLink().statements[0],
          periodStart: '2024-01-01',
          periodEnd: '2024-03-31',
        },
      ],
    })
    const plan = buildSettlementRepairPlan(report)

    expect(plan.steps).toEqual([])
    expect(plan.skipped[0]).toMatchObject({ reason: 'ambiguous' })
  })

  it('produces a deterministic plan hash and a stable resource id', () => {
    const report = buildSettlementAuditReport(auditInputWithMissingLink())
    const first = buildSettlementRepairPlan(report)
    const second = buildSettlementRepairPlan(report)

    expect(first.planHash).toBe(second.planHash)
    expect(repairResourceIdForPlan(first)).toBe(periodId)

    const unscoped = { ...first, scope: { periodId: null } }
    expect(repairResourceIdForPlan(unscoped)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})

describe('applySettlementRepairPlan', () => {
  it('dry-run writes nothing and reports ready steps', async () => {
    const { db, writes } = makeFakeDb({
      sales_statements: [{ id: 'statement-1', settlement_period_id: null, is_archived: false }],
    })
    const report = buildSettlementAuditReport(auditInputWithMissingLink())
    const plan = buildSettlementRepairPlan(report)

    const result = await applySettlementRepairPlan(db, plan, {
      actorId: 'admin-1',
      operationId: '99999999-9999-4999-8999-999999999999',
      dryRun: true,
    })

    expect(writes).toEqual([])
    expect(result.status).toBe('ready')
    expect(result.steps[0].status).toBe('ready')
    expect(result.restore).toEqual({ capturedAt: expect.any(String), updates: [], inserts: [] })
  })

  it('applies the period link, audits it and journals the run', async () => {
    const { db, state, writes } = makeFakeDb({
      sales_statements: [{ id: 'statement-1', settlement_period_id: null, is_archived: false }],
    })
    const report = buildSettlementAuditReport(auditInputWithMissingLink())
    const plan = buildSettlementRepairPlan(report)
    const operationId = '99999999-9999-4999-8999-999999999999'

    const result = await applySettlementRepairPlan(db, plan, {
      actorId: 'admin-1',
      operationId,
      dryRun: false,
    })

    expect(result.status).toBe('ready')
    expect(result.steps[0].status).toBe('applied')
    expect(state.sales_statements[0].settlement_period_id).toBe(periodId)
    expect(result.restore.updates).toEqual([
      {
        table: 'sales_statements',
        id: 'statement-1',
        before: { id: 'statement-1', settlement_period_id: null, is_archived: false },
      },
    ])
    expect(state.financial_audit_events).toHaveLength(1)
    expect(state.settlement_operations[0]).toMatchObject({
      id: operationId,
      operation_type: 'settlement_repair',
      status: 'ready',
    })
    expect(writes.some((write) => write.table === 'settlement_operations')).toBe(true)
  })

  it('replays a completed run without new writes', async () => {
    const { db, state } = makeFakeDb({
      sales_statements: [{ id: 'statement-1', settlement_period_id: null, is_archived: false }],
    })
    const report = buildSettlementAuditReport(auditInputWithMissingLink())
    const plan = buildSettlementRepairPlan(report)
    const operationId = '99999999-9999-4999-8999-999999999999'

    const first = await applySettlementRepairPlan(db, plan, { actorId: 'admin-1', operationId, dryRun: false })
    const auditEventsAfterFirst = state.financial_audit_events.length
    const second = await applySettlementRepairPlan(db, plan, { actorId: 'admin-1', operationId, dryRun: false })

    expect(second).toEqual(first)
    expect(state.financial_audit_events).toHaveLength(auditEventsAfterFirst)
  })

  it('rejects an operation id that was used with a different plan', async () => {
    const operationId = '99999999-9999-4999-8999-999999999999'
    const { db } = makeFakeDb({
      sales_statements: [{ id: 'statement-1', settlement_period_id: null, is_archived: false }],
      settlement_operations: [
        {
          id: operationId,
          operation_type: 'settlement_repair',
          resource_type: 'settlement_period',
          resource_id: periodId,
          status: 'ready',
          payload_hash: 'different-hash',
          result: {},
        },
      ],
    })
    const report = buildSettlementAuditReport(auditInputWithMissingLink())
    const plan = buildSettlementRepairPlan(report)

    await expect(
      applySettlementRepairPlan(db, plan, { actorId: 'admin-1', operationId, dryRun: false }),
    ).rejects.toBeInstanceOf(BusinessRuleError)
  })

  it('stops at a changed precondition and skips the remaining steps', async () => {
    const { db, state } = makeFakeDb({
      sales_statements: [
        { id: 'statement-1', settlement_period_id: 'other-period', is_archived: false },
      ],
    })
    const report = buildSettlementAuditReport(auditInputWithMissingLink())
    const plan = buildSettlementRepairPlan(report)

    const result = await applySettlementRepairPlan(db, plan, {
      actorId: 'admin-1',
      operationId: '99999999-9999-4999-8999-999999999999',
      dryRun: false,
    })

    expect(result.status).toBe('conflict')
    expect(result.steps[0].status).toBe('conflict')
    expect(state.sales_statements[0].settlement_period_id).toBe('other-period')
  })

  it('inserts a missing carry_in and skips it on a second application', async () => {
    const { db, state } = makeFakeDb()
    const report = buildSettlementAuditReport(auditInputWithMissingCarryIn())
    const plan = buildSettlementRepairPlan(report)

    expect(plan.steps[0].action).toBe('insert_carry_in_ledger')

    const first = await applySettlementRepairPlan(db, plan, {
      actorId: 'admin-1',
      operationId: '99999999-9999-4999-8999-999999999991',
      dryRun: false,
    })
    expect(first.status).toBe('ready')
    expect(first.steps[0].status).toBe('applied')
    expect(state.artist_settlement_ledger).toHaveLength(1)
    expect(state.artist_settlement_ledger[0]).toMatchObject({
      entry_type: 'carry_in',
      settlement_period_id: periodId,
      artist_id: artistId,
      reference_type: 'settlement_period',
      reference_id: 'period-0',
    })
    expect(first.restore.inserts).toHaveLength(1)

    const second = await applySettlementRepairPlan(db, plan, {
      actorId: 'admin-1',
      operationId: '99999999-9999-4999-8999-999999999992',
      dryRun: false,
    })
    expect(second.steps[0].status).toBe('skipped')
    expect(state.artist_settlement_ledger).toHaveLength(1)
  })
})
