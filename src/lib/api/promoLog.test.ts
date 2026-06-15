import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  getPromoLogEntries,
  createPromoLogEntry,
  updatePromoLogEntry,
  deletePromoLogEntry,
  getPromoLogEntryR2Key,
} from './promoLog'

type DbClient = SupabaseClient<Database>

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

const row = {
  id: 'entry-1',
  artist_id: 'artist-1',
  action_date: '2026-06-01',
  description: 'Newsletter sent to 10k contacts',
  budget_amount: 250.0,
  budget_currency: 'EUR',
  proof_url: 'https://cdn.example/promo-proofs/artist-1/proof.png',
  proof_r2_key: 'promo-proofs/artist-1/proof.png',
  created_by: 'admin-uid',
  created_at: '2026-06-01T10:00:00Z',
}

describe('promoLog DAL', () => {
  describe('getPromoLogEntries', () => {
    it('returns mapped entries', async () => {
      const db = makeMockDb([row])
      const entries = await getPromoLogEntries(db, 'artist-1')
      expect(entries).toHaveLength(1)
      const e = entries[0]
      expect(e.id).toBe('entry-1')
      expect(e.artistId).toBe('artist-1')
      expect(e.actionDate).toBe('2026-06-01')
      expect(e.description).toBe('Newsletter sent to 10k contacts')
      expect(e.budgetAmount).toBe(250.0)
      expect(e.budgetCurrency).toBe('EUR')
      expect(e.proofUrl).toBe('https://cdn.example/promo-proofs/artist-1/proof.png')
      expect(e.proofR2Key).toBe('promo-proofs/artist-1/proof.png')
      expect(e.createdBy).toBe('admin-uid')
    })

    it('returns empty array when no rows', async () => {
      const db = makeMockDb([])
      const entries = await getPromoLogEntries(db, 'artist-1')
      expect(entries).toHaveLength(0)
    })

    it('throws on DB error', async () => {
      const db = makeMockDb(null, { message: 'DB error' })
      await expect(getPromoLogEntries(db, 'artist-1')).rejects.toThrow('DB error')
    })
  })

  describe('createPromoLogEntry', () => {
    it('returns the new entry', async () => {
      const db = makeMockDb(row)
      const entry = await createPromoLogEntry(db, {
        artist_id: 'artist-1',
        action_date: '2026-06-01',
        description: 'Newsletter sent to 10k contacts',
        budget_amount: 250.0,
        budget_currency: 'EUR',
        proof_url: null,
        proof_r2_key: null,
        created_by: 'admin-uid',
      })
      expect(entry.id).toBe('entry-1')
      expect(entry.budgetAmount).toBe(250.0)
    })

    it('maps null budget correctly', async () => {
      const rowNoBudget = { ...row, budget_amount: null }
      const db = makeMockDb(rowNoBudget)
      const entry = await createPromoLogEntry(db, {
        artist_id: 'artist-1',
        action_date: '2026-06-01',
        description: 'Free playlist pitch',
      })
      expect(entry.budgetAmount).toBeNull()
    })

    it('throws on DB error', async () => {
      const db = makeMockDb(null, { message: 'Insert error' })
      await expect(
        createPromoLogEntry(db, {
          artist_id: 'artist-1',
          action_date: '2026-06-01',
          description: 'Test',
        }),
      ).rejects.toThrow('Insert error')
    })
  })

  describe('deletePromoLogEntry', () => {
    it('resolves without throwing', async () => {
      const db = makeMockDb(null, null)
      await expect(deletePromoLogEntry(db, 'entry-1')).resolves.toBeUndefined()
    })

    it('throws on DB error', async () => {
      const db = makeMockDb(null, { message: 'Delete error' })
      await expect(deletePromoLogEntry(db, 'entry-1')).rejects.toThrow('Delete error')
    })
  })

  describe('updatePromoLogEntry', () => {
    it('returns the updated entry', async () => {
      const updatedRow = { ...row, description: 'Updated description', budget_amount: 500 }
      const db = makeMockDb(updatedRow)
      const entry = await updatePromoLogEntry(db, 'entry-1', {
        description: 'Updated description',
        budget_amount: 500,
      })
      expect(entry.id).toBe('entry-1')
      expect(entry.description).toBe('Updated description')
      expect(entry.budgetAmount).toBe(500)
    })

    it('returns entry with null proof when cleared', async () => {
      const rowNoProof = { ...row, proof_url: null, proof_r2_key: null }
      const db = makeMockDb(rowNoProof)
      const entry = await updatePromoLogEntry(db, 'entry-1', {
        proof_url: null,
        proof_r2_key: null,
      })
      expect(entry.proofUrl).toBeNull()
      expect(entry.proofR2Key).toBeNull()
    })

    it('throws when no data returned', async () => {
      const db = makeMockDb(null, null)
      await expect(updatePromoLogEntry(db, 'entry-1', { description: 'Test' })).rejects.toThrow(
        'No data returned from updatePromoLogEntry',
      )
    })

    it('throws on DB error', async () => {
      const db = makeMockDb(null, { message: 'Update error' })
      await expect(updatePromoLogEntry(db, 'entry-1', { description: 'Test' })).rejects.toThrow(
        'Update error',
      )
    })
  })

  describe('getPromoLogEntryR2Key', () => {
    it('returns the r2 key', async () => {
      const db = makeMockDb({ proof_r2_key: 'promo-proofs/artist-1/img.png' })
      const key = await getPromoLogEntryR2Key(db, 'entry-1')
      expect(key).toBe('promo-proofs/artist-1/img.png')
    })

    it('returns null when key is absent', async () => {
      const db = makeMockDb({ proof_r2_key: null })
      const key = await getPromoLogEntryR2Key(db, 'entry-1')
      expect(key).toBeNull()
    })
  })
})
