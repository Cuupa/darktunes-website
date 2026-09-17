import { describe, expect, it, vi } from 'vitest'
import {
  decodeAuditCursor,
  encodeAuditCursor,
  scanSettlementAudit,
} from './settlementAudit'

interface QueryLog {
  method: string
  args: unknown[]
}

function makeQuery(rows: Record<string, unknown>[], log: QueryLog[]) {
  let limitCount: number | null = null
  const builder = {
    select: (...args: unknown[]) => {
      log.push({ method: 'select', args })
      return builder
    },
    order: (...args: unknown[]) => {
      log.push({ method: 'order', args })
      return builder
    },
    or: (...args: unknown[]) => {
      log.push({ method: 'or', args })
      return builder
    },
    in: (...args: unknown[]) => {
      log.push({ method: 'in', args })
      return builder
    },
    limit: (count: number) => {
      log.push({ method: 'limit', args: [count] })
      limitCount = count
      return builder
    },
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      resolve({
        data: limitCount === null ? rows : rows.slice(0, limitCount),
        error: null,
      }),
  }
  return builder
}

function makeDb(tables: Record<string, Record<string, unknown>[]>) {
  const log: QueryLog[] = []
  const mutationCalls: string[] = []
  const from = vi.fn((table: string) => {
    const builder = makeQuery(tables[table] ?? [], log)
    return new Proxy(builder, {
      get(target, property) {
        if (typeof property === 'string' && ['insert', 'update', 'delete', 'upsert', 'rpc'].includes(property)) {
          mutationCalls.push(`${table}.${property}`)
        }
        return Reflect.get(target, property)
      },
    })
  })
  return { db: { from } as never, log, mutationCalls }
}

const periodRow = {
  id: '11111111-1111-4111-8111-111111111111',
  label: '2025-10-01 – 2026-03-31',
  period_start: '2025-10-01',
  period_end: '2026-03-31',
  status: 'open',
}

const statementRow = {
  id: '22222222-2222-4222-8222-222222222222',
  artist_id: '33333333-3333-4333-8333-333333333333',
  settlement_period_id: null,
  period_start: '2025-10-01',
  period_end: '2026-03-31',
  status: 'approved',
  is_archived: false,
  amount_eur: 100,
  first_viewed_at: '2025-11-01T00:00:00Z',
  created_at: '2025-11-01T00:00:00Z',
}

const invoiceRow = {
  id: '44444444-4444-4444-8444-444444444444',
  artist_id: '33333333-3333-4333-8333-333333333333',
  statement_id: null,
  status: 'sent',
  settlement_period_id: null,
  service_period_start: '2025-10-01',
  service_period_end: '2026-03-31',
  pdf_url: null,
  pdf_sha256: null,
  delivery_status: 'not_sent',
  delivery_attempted_at: null,
  paid_amount_cents: null,
  outstanding_amount_cents: null,
  updated_at: '2025-11-01T00:00:00Z',
}

const ledgerRow = {
  id: '55555555-5555-4555-8555-555555555555',
  artist_id: '33333333-3333-4333-8333-333333333333',
  settlement_period_id: null,
  entry_type: 'statement_payout',
  amount_eur: 100,
  reference_type: 'sales_statement',
  reference_id: statementRow.id,
  created_at: '2025-11-01T00:00:00Z',
}

const carryRow = {
  id: '66666666-6666-4666-8666-666666666666',
  from_period_id: periodRow.id,
  to_period_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  artist_id: '33333333-3333-4333-8333-333333333333',
  opening_balance_eur: 20,
  applied_at: '2025-10-01T00:00:00Z',
  created_at: '2025-11-01T00:00:00Z',
}

const batchRow = {
  id: '77777777-7777-4777-8777-777777777777',
  status: 'failed',
  file_hash: null,
  period_start: '2025-10',
  period_end: '2026-03',
  created_at: '2025-11-01T00:00:00Z',
}

const operationRow = {
  id: '88888888-8888-4888-8888-888888888888',
  operation_type: 'invoice_create',
  resource_type: 'artist_invoice',
  resource_id: invoiceRow.id,
  status: 'ready',
  payload_hash: 'hash-a',
  created_at: '2025-11-01T00:00:00Z',
}

function makeTables(overrides: Record<string, Record<string, unknown>[]> = {}) {
  return {
    settlement_periods: [periodRow],
    sales_statements: [statementRow],
    artist_invoices: [invoiceRow],
    artist_settlement_ledger: [ledgerRow],
    period_carry_forwards: [carryRow],
    distributor_import_batches: [batchRow],
    settlement_operations: [operationRow],
    ...overrides,
  }
}

describe('scanSettlementAudit', () => {
  it('scans read-only and reports findings from the mapped rows', async () => {
    const { db, mutationCalls } = makeDb(makeTables())
    const report = await scanSettlementAudit(db, {
      generatedAt: '2026-09-17T00:00:00.000Z',
    })

    expect(report.generatedAt).toBe('2026-09-17T00:00:00.000Z')
    expect(report.scope.periodId).toBeNull()
    expect(mutationCalls).toEqual([])
    expect(report.summary.byCategory.period_link).toBe(3)
    expect(report.summary.byCategory.invoice_without_pdf).toBe(1)
    expect(report.summary.byCategory.unconfirmed_import_batch).toBe(1)
    expect(report.summary.byCategory.carry_forward_integrity).toBe(1)
    expect(report.truncated).toBe(false)
  })

  it('applies the period filter only for a scoped scan', async () => {
    const scoped = makeDb(makeTables())
    await scanSettlementAudit(scoped.db, { periodId: periodRow.id })

    const orCalls = scoped.log.filter((entry) => entry.method === 'or')
    expect(orCalls.length).toBe(4)
    expect(String(orCalls[0].args[0])).toContain(`settlement_period_id.eq.${periodRow.id}`)
    expect(String(orCalls[3].args[0])).toContain(`from_period_id.eq.${periodRow.id}`)

    const unscoped = makeDb(makeTables())
    await scanSettlementAudit(unscoped.db)
    expect(unscoped.log.some((entry) => entry.method === 'or')).toBe(false)
  })

  it('rejects an invalid period id before querying', async () => {
    const { db, log } = makeDb(makeTables())
    await expect(scanSettlementAudit(db, { periodId: 'not-a-uuid' })).rejects.toThrow(
      /Invalid period id/,
    )
    expect(log).toEqual([])
  })

  it('flags truncation when a table exceeds the row limit', async () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      ...statementRow,
      id: `99999999-9999-4999-8999-99999999999${index}`,
    }))
    const { db } = makeDb(makeTables({ sales_statements: rows }))

    const report = await scanSettlementAudit(db, { rowLimit: 2 })

    expect(report.truncated).toBe(true)
    expect(
      report.findings.filter(
        (finding) =>
          finding.category === 'period_link' && finding.entityType === 'sales_statement',
      ),
    ).toHaveLength(2)
  })
})

describe('audit cursor', () => {
  it('round-trips a finding id through an opaque cursor', () => {
    const cursor = encodeAuditCursor('period_link:sales_statement:abc')
    expect(cursor).not.toContain('period_link')
    expect(decodeAuditCursor(cursor)).toBe('period_link:sales_statement:abc')
  })

  it('rejects malformed cursors', () => {
    expect(decodeAuditCursor('not-base64url!!')).toBeNull()
    expect(decodeAuditCursor(Buffer.from('offset:5').toString('base64url'))).toBeNull()
    expect(decodeAuditCursor(Buffer.from('after:').toString('base64url'))).toBeNull()
  })
})
