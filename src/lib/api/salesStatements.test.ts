import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getSalesStatementsByArtistId,
  createSalesStatement,
  getSalesStatementById,
  approveSalesStatement,
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
