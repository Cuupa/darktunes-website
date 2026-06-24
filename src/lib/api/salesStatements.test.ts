import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getSalesStatementsByArtistId,
  createSalesStatement,
  getSalesStatementById,
  approveSalesStatement,
  approveAndNotifySalesStatement,
  createCorrectionStatement,
  updateSalesStatementStatus,
  getSalesSummariesForAdmin,
} from './salesStatements'

type DbClient = SupabaseClient<Database>
type SalesStatementRow = Database['public']['Tables']['sales_statements']['Row']

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const mockStatementRow: SalesStatementRow = {
  id: 'stmt-uuid-1',
  artist_id: 'artist-uuid',
  filename: 'Statement_2024_Q1.pdf',
  r2_key: 'statements/artist-uuid/Statement_2024_Q1.pdf',
  period: 'Q1-2024',
  amount_eur: 1234.56,
  status: 'draft',
  label_notes: null,
  label_approved_at: null,
  period_start: null,
  period_end: null,
  total_streams: 0,
  batch_id: null,
  first_viewed_at: null,
  last_viewed_at: null,
  view_count: 0,
  document_type: 'original',
  correction_of_id: null,
  superseded_by_id: null,
  version: 1,
  reporting_currency: 'EUR',
  amount_reporting: null,
  fx_rate_to_eur: null,
  fx_rate_date: null,
  fx_source: null,
  settlement_period_id: null,
  is_archived: false,
  created_at: '2024-04-01T00:00:00Z',
}

describe('getSalesStatementsByArtistId', () => {
  it('returns empty array when no statements exist', async () => {
    const db = makeMockDb([])
    const result = await getSalesStatementsByArtistId(db, 'artist-uuid')
    expect(result).toEqual([])
  })

  it('maps rows to SalesStatement domain objects', async () => {
    const db = makeMockDb([mockStatementRow])
    const result = await getSalesStatementsByArtistId(db, 'artist-uuid')
    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('Statement_2024_Q1.pdf')
    expect(result[0].r2Key).toBe('statements/artist-uuid/Statement_2024_Q1.pdf')
    expect(result[0].period).toBe('Q1-2024')
    expect(result[0].amountEur).toBe(1234.56)
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'Row-level security violation', code: 'PGRST301' })
    await expect(getSalesStatementsByArtistId(db, 'artist-uuid')).rejects.toThrow(
      'Row-level security violation',
    )
  })
})

describe('createSalesStatement', () => {
  it('inserts and returns the mapped domain object', async () => {
    const db = makeMockDb(mockStatementRow)
    const result = await createSalesStatement(db, {
      artistId: 'artist-uuid',
      filename: 'Statement_2024_Q1.pdf',
      r2Key: 'statements/artist-uuid/Statement_2024_Q1.pdf',
      period: 'Q1-2024',
      amountEur: 1234.56,
    })
    expect(result.id).toBe('stmt-uuid-1')
    expect(result.r2Key).toBe('statements/artist-uuid/Statement_2024_Q1.pdf')
    expect(result.amountEur).toBe(1234.56)
    expect(result.period).toBe('Q1-2024')
  })

  it('maps null amount_eur to undefined', async () => {
    const rowWithoutAmount: SalesStatementRow = { ...mockStatementRow, amount_eur: null }
    const db = makeMockDb(rowWithoutAmount)
    const result = await createSalesStatement(db, {
      artistId: 'artist-uuid',
      filename: 'Statement_2024_Q1.pdf',
      r2Key: 'statements/artist-uuid/Statement_2024_Q1.pdf',
      period: 'Q1-2024',
    })
    expect(result.amountEur).toBeUndefined()
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'duplicate key value violates unique constraint', code: '23505' })
    await expect(
      createSalesStatement(db, {
        artistId: 'artist-uuid',
        filename: 'dup.pdf',
        r2Key: 'statements/artist-uuid/dup.pdf',
        period: 'Q2-2024',
      }),
    ).rejects.toThrow('duplicate key value violates unique constraint')
  })

  it('throws when no row is returned', async () => {
    const db = makeMockDb(null, null) // no error, no data
    await expect(
      createSalesStatement(db, {
        artistId: 'artist-uuid',
        filename: 'empty.pdf',
        r2Key: 'statements/artist-uuid/empty.pdf',
        period: 'Q3-2024',
      }),
    ).rejects.toThrow('No data returned from createSalesStatement')
  })
})

describe('getSalesStatementById', () => {
  it('returns the mapped statement when found', async () => {
    const db = makeMockDb(mockStatementRow)
    const result = await getSalesStatementById(db, 'stmt-uuid-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('stmt-uuid-1')
    expect(result!.status).toBe('draft')
  })

  it('returns null when not found (PGRST116)', async () => {
    const db = makeMockDb(null, { code: 'PGRST116', message: 'not found' })
    const result = await getSalesStatementById(db, 'nonexistent')
    expect(result).toBeNull()
  })

  it('throws on other database error', async () => {
    const db = makeMockDb(null, { code: '42501', message: 'permission denied' })
    await expect(getSalesStatementById(db, 'stmt-uuid-1')).rejects.toThrow('permission denied')
  })
})

describe('approveSalesStatement', () => {
  it('updates status to label_approved and returns mapped domain object', async () => {
    const approvedRow: SalesStatementRow = {
      ...mockStatementRow,
      status: 'label_approved',
      label_notes: 'Looks good.',
      label_approved_at: '2024-04-02T12:00:00Z',
    }
    const db = makeMockDb(approvedRow)
    const result = await approveSalesStatement(db, 'stmt-uuid-1', 'Looks good.')
    expect(result.status).toBe('label_approved')
    expect(result.labelNotes).toBe('Looks good.')
    expect(result.labelApprovedAt).toBe('2024-04-02T12:00:00Z')
  })

  it('works without notes', async () => {
    const approvedRow: SalesStatementRow = {
      ...mockStatementRow,
      status: 'label_approved',
      label_notes: null,
      label_approved_at: '2024-04-02T12:00:00Z',
    }
    const db = makeMockDb(approvedRow)
    const result = await approveSalesStatement(db, 'stmt-uuid-1')
    expect(result.status).toBe('label_approved')
    expect(result.labelNotes).toBeUndefined()
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'update failed' })
    await expect(approveSalesStatement(db, 'stmt-uuid-1')).rejects.toThrow('update failed')
  })
})

describe('approveAndNotifySalesStatement', () => {
  it('approves and marks artist_notified when email succeeds', async () => {
    const approvedRow: SalesStatementRow = {
      ...mockStatementRow,
      status: 'label_approved',
      label_approved_at: '2024-04-02T12:00:00Z',
    }
    const notifiedRow: SalesStatementRow = {
      ...approvedRow,
      status: 'artist_notified',
    }

    const from = vi
      .fn()
      .mockReturnValueOnce(makeBuilder(approvedRow))
      .mockReturnValueOnce(makeBuilder(notifiedRow))

    const db = { from } as unknown as DbClient
    const notify = vi.fn().mockResolvedValue({ success: true })

    const result = await approveAndNotifySalesStatement(db, 'stmt-uuid-1', notify, 'Approved')

    expect(result.emailSent).toBe(true)
    expect(result.statement.status).toBe('artist_notified')
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('keeps label_approved when email fails', async () => {
    const approvedRow: SalesStatementRow = {
      ...mockStatementRow,
      status: 'label_approved',
      label_approved_at: '2024-04-02T12:00:00Z',
    }
    const db = makeMockDb(approvedRow)
    const notify = vi.fn().mockResolvedValue({ success: false, error: 'SMTP down' })

    const result = await approveAndNotifySalesStatement(db, 'stmt-uuid-1', notify)

    expect(result.emailSent).toBe(false)
    expect(result.emailError).toBe('SMTP down')
    expect(result.statement.status).toBe('label_approved')
  })
})

describe('updateSalesStatementStatus', () => {
  it('updates and returns the mapped domain object with new status', async () => {
    const acknowledgedRow: SalesStatementRow = {
      ...mockStatementRow,
      status: 'acknowledged',
    }
    const db = makeMockDb(acknowledgedRow)
    const result = await updateSalesStatementStatus(db, 'stmt-uuid-1', 'acknowledged')
    expect(result.status).toBe('acknowledged')
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'update error' })
    await expect(
      updateSalesStatementStatus(db, 'stmt-uuid-1', 'acknowledged'),
    ).rejects.toThrow('update error')
  })
})

describe('createCorrectionStatement', () => {
  it('rejects draft statements', async () => {
    const db = makeMockDb(mockStatementRow)
    await expect(
      createCorrectionStatement(db, 'stmt-uuid-1', { amountEur: 99 }, 'actor-1'),
    ).rejects.toThrow('Cannot correct statement in status "draft"')
  })

  it('creates a correction draft and supersedes the original', async () => {
    const original: SalesStatementRow = {
      ...mockStatementRow,
      status: 'label_approved',
      amount_eur: 100,
      period_start: '2025-01-01',
      period_end: '2025-03-31',
    }
    const correction: SalesStatementRow = {
      ...original,
      id: 'stmt-correction',
      status: 'draft',
      amount_eur: 120,
      document_type: 'correction',
      correction_of_id: 'stmt-uuid-1',
      version: 2,
      filename: 'Statement_2024_Q1-Korrektur.pdf',
    }

    let singleCalls = 0
    const builder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        singleCalls += 1
        if (singleCalls === 1) return Promise.resolve({ data: original, error: null })
        return Promise.resolve({ data: correction, error: null })
      }),
    }
    const p = Promise.resolve({ data: null, error: null })
    Object.assign(builder, {
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    })

    const db = { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient
    const result = await createCorrectionStatement(db, 'stmt-uuid-1', { amountEur: 120 }, 'actor-1')

    expect(result.id).toBe('stmt-correction')
    expect(result.amountEur).toBe(120)
    expect(builder.update).toHaveBeenCalled()
  })
})

describe('getSalesSummariesForAdmin', () => {
  it('returns all statements unfiltered', async () => {
    const db = makeMockDb([mockStatementRow, { ...mockStatementRow, id: 'stmt-uuid-2' }])
    const result = await getSalesSummariesForAdmin(db)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when no statements', async () => {
    const db = makeMockDb([])
    const result = await getSalesSummariesForAdmin(db)
    expect(result).toEqual([])
  })

  it('throws on database error', async () => {
    const db = makeMockDb(null, { message: 'query failed' })
    await expect(getSalesSummariesForAdmin(db)).rejects.toThrow('query failed')
  })
})
