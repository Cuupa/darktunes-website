import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSalesStatementsByArtistId } from './salesStatements'

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
