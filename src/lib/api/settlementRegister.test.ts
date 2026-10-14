import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { archiveSettlementPeriod, getSettlementPeriodById } from './settlementPeriods'
import { appendLedgerEntry, createPeriodCarryForwards } from './settlementLedger'
import {
  archivePeriodWithCarryForward,
  buildSettlementRegister,
  computeCarryForwardBalances,
} from './settlementRegister'

type DbClient = SupabaseClient<Database>

const mockPeriod = {
  id: 'period-1',
  periodStart: '2025-01-01',
  periodEnd: '2025-03-31',
  status: 'open' as const,
  createdAt: '2024-01-01T00:00:00Z',
}

vi.mock('@/lib/api/settlementPeriods', () => ({
  getSettlementPeriodByDates: vi.fn(async () => mockPeriod),
  getOrCreateSettlementPeriod: vi.fn(async () => mockPeriod),
  getSettlementPeriodById: vi.fn(async () => mockPeriod),
  archiveSettlementPeriod: vi.fn(async () => mockPeriod),
}))

vi.mock('@/lib/api/salesStatements', () => ({
  getSalesStatementsForPeriod: vi.fn(async () => [
    {
      id: 'stmt-1',
      artist_id: 'artist-1',
      status: 'label_approved',
      first_viewed_at: '2025-02-01T00:00:00Z',
      amount_eur: 500,
    },
    {
      id: 'stmt-2',
      artist_id: 'artist-2',
      status: 'draft',
      first_viewed_at: null,
      amount_eur: 200,
    },
  ]),
}))

vi.mock('@/lib/api/artistInvoices', () => ({
  listInvoicesByStatementIds: vi.fn(async () => [
    {
      id: 'inv-1',
      statementId: 'stmt-1',
      status: 'sent',
      artistInvoiceNumber: 'INV-001',
      invoiceNumber: 'INV-001',
      receivedAt: undefined,
      paidAt: undefined,
      paidAmountCents: 0,
      outstandingAmountCents: 50000,
      deliveryStatus: 'failed',
    },
  ]),
}))

vi.mock('@/lib/api/settlementLedger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/settlementLedger')>()
  return {
    ...actual,
    getOutstandingBalancesForPeriod: vi.fn(async () => new Map([['artist-1', 120]])),
    createPeriodCarryForwards: vi.fn(async () => undefined),
    appendLedgerEntry: vi.fn(async () => ({ id: 'entry-1' })),
  }
})

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeDb(tableData: Record<string, unknown>): DbClient {
  return {
    from: vi.fn((table: string) => makeBuilder(tableData[table] ?? null)),
  } as unknown as DbClient
}

describe('buildSettlementRegister', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds register rows with KPIs for artists with statements or open balances', async () => {
    const db = makeDb({
      artists: [
        { id: 'artist-1', name: 'Neuroklast' },
        { id: 'artist-2', name: 'Guest Act' },
        { id: 'artist-3', name: 'Idle Act' },
      ],
      period_carry_forwards: [],
    })

    const register = await buildSettlementRegister(db, '2025-01-01', '2025-03-31')

    expect(register.period?.id).toBe('period-1')
    expect(register.rows).toHaveLength(2)
    expect(register.rows.map(r => r.artistName).sort()).toEqual(['Guest Act', 'Neuroklast'])

    const neuro = register.rows.find(r => r.artistId === 'artist-1')
    expect(neuro).toMatchObject({
      statementStatus: 'label_approved',
      invoiceStatus: 'sent',
      invoiceDeliveryStatus: 'failed',
      ledgerBalanceEur: 120,
      statementAmountEur: 500,
    })

    expect(register.kpis.approved).toBe(1)
    expect(register.kpis.invoiced).toBe(1)
    expect(register.kpis.openBalanceEur).toBe(120)
  })

  it('includes carry-forward and opening balance from period_carry_forwards', async () => {
    const db = makeDb({
      artists: [{ id: 'artist-1', name: 'Neuroklast' }],
      period_carry_forwards: [
        { artist_id: 'artist-1', opening_balance_eur: 15.5, from_period_id: 'period-1', to_period_id: 'period-2' },
      ],
    })

    const register = await buildSettlementRegister(db, '2025-01-01', '2025-03-31')
    const row = register.rows.find(r => r.artistId === 'artist-1')
    expect(row?.carryForwardEur).toBe(15.5)
    expect(row?.openingBalanceEur).toBe(15.5)
  })
})

describe('computeCarryForwardBalances', () => {
  it('returns non-zero opening balances for artists with outstanding amounts', async () => {
    const db = makeDb({
      sales_statements: [
        { id: 'stmt-1', artist_id: 'artist-1', amount_eur: 80, status: 'label_approved' },
      ],
      artist_invoices: [
        {
          artist_id: 'artist-1',
          settlement_period_id: 'period-1',
          line_items: [{ qty: 1, unit_price_cents: 2500 }],
          paid_amount_cents: 0,
          outstanding_amount_cents: 2500,
          status: 'sent',
        },
      ],
    })

    const balances = await computeCarryForwardBalances(db, 'period-1')

    expect(balances).toHaveLength(1)
    expect(balances[0]?.artistId).toBe('artist-1')
    expect(balances[0]?.openingBalanceEur).toBeGreaterThan(0)
    expect(balances[0]?.breakdown.unpaidInvoiceCents).toBe(2500)
  })

  it('skips artists with negligible carry-forward totals', async () => {
    const db = makeDb({
      sales_statements: [
        { id: 'stmt-1', artist_id: 'artist-2', amount_eur: 0.001, status: 'paid' },
      ],
      artist_invoices: [],
    })

    const balances = await computeCarryForwardBalances(db, 'period-1')
    expect(balances).toHaveLength(0)
  })

  it('does not fall back to statement activity when ledger rows exist and sum to 0', async () => {
    const db = makeDb({
      sales_statements: [
        { id: 'stmt-1', artist_id: 'artist-1', amount_eur: 80, status: 'label_approved' },
      ],
      artist_invoices: [],
      artist_settlement_ledger: [
        { artist_id: 'artist-1', entry_type: 'statement_payout', amount_eur: 80 },
        { artist_id: 'artist-1', entry_type: 'payment', amount_eur: -80 },
      ],
    })

    const balances = await computeCarryForwardBalances(db, 'period-1')
    expect(balances).toHaveLength(0)
  })

  it('keeps the incoming carry_in in the balance carried to the next period', async () => {
    const db = makeDb({
      sales_statements: [{ id: 'stmt-1', artist_id: 'artist-1', amount_eur: 0, status: 'paid' }],
      artist_invoices: [],
      artist_settlement_ledger: [
        { artist_id: 'artist-1', entry_type: 'carry_in', amount_eur: 100 },
      ],
    })

    const balances = await computeCarryForwardBalances(db, 'period-1')
    expect(balances).toHaveLength(1)
    expect(balances[0]?.breakdown.statementBalanceEur).toBe(100)
    expect(balances[0]?.openingBalanceEur).toBe(100)
  })

  it('ignores a previously posted carry_out so a retried close stays stable', async () => {
    const db = makeDb({
      sales_statements: [
        { id: 'stmt-1', artist_id: 'artist-1', amount_eur: 100, status: 'label_approved' },
      ],
      artist_invoices: [],
      artist_settlement_ledger: [
        { artist_id: 'artist-1', entry_type: 'statement_payout', amount_eur: 100 },
        { artist_id: 'artist-1', entry_type: 'carry_out', amount_eur: -100 },
      ],
    })

    const balances = await computeCarryForwardBalances(db, 'period-1')
    expect(balances).toHaveLength(1)
    expect(balances[0]?.breakdown.statementBalanceEur).toBe(100)
  })

  it('uses outstanding_amount_cents instead of recomputed VAT gross', async () => {
    const db = makeDb({
      sales_statements: [
        { id: 'stmt-1', artist_id: 'artist-1', amount_eur: 0, status: 'invoiced' },
      ],
      artist_invoices: [
        {
          artist_id: 'artist-1',
          settlement_period_id: 'period-1',
          line_items: [{ qty: 1, unit_price_cents: 10000 }],
          paid_amount_cents: 0,
          outstanding_amount_cents: 5000,
          tax_rate_pct: 19,
          status: 'sent',
        },
      ],
    })

    const balances = await computeCarryForwardBalances(db, 'period-1')
    expect(balances[0]?.breakdown.unpaidInvoiceCents).toBe(5000)
    expect(balances[0]?.openingBalanceEur).toBe(50)
  })
})

describe('archivePeriodWithCarryForward', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns without posting carries when the period is already archived', async () => {
    vi.mocked(getSettlementPeriodById).mockResolvedValueOnce({
      ...mockPeriod,
      status: 'archived',
    } as never)

    await archivePeriodWithCarryForward(
      makeDb({}),
      'period-1',
      'actor-1',
      '2025-04-01',
      '2025-06-30',
    )

    expect(createPeriodCarryForwards).not.toHaveBeenCalled()
    expect(archiveSettlementPeriod).not.toHaveBeenCalled()
  })

  it('posts carries and archives an open period', async () => {
    const db = makeDb({})

    await archivePeriodWithCarryForward(db, 'period-1', 'actor-1', '2025-04-01', '2025-06-30')

    expect(createPeriodCarryForwards).toHaveBeenCalledWith(db, 'period-1', [], 'actor-1')
    expect(archiveSettlementPeriod).toHaveBeenCalledWith(db, 'period-1', 'actor-1')
  })

  it('swallows a duplicate carry_in from a concurrent close and still archives', async () => {
    vi.mocked(getSettlementPeriodById).mockResolvedValueOnce({ ...mockPeriod, status: 'open' } as never)
    vi.mocked(appendLedgerEntry).mockRejectedValueOnce({ code: '23505', message: 'duplicate key' })
    const db = makeDb({
      sales_statements: [
        { id: 'stmt-1', artist_id: 'artist-1', amount_eur: 50, status: 'label_approved' },
      ],
    })

    await archivePeriodWithCarryForward(db, 'period-1', 'actor-1', '2025-04-01', '2025-06-30')

    expect(appendLedgerEntry).toHaveBeenCalled()
    expect(archiveSettlementPeriod).toHaveBeenCalledWith(db, 'period-1', 'actor-1')
  })
})
