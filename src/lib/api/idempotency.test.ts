import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  checkAndClaimIdempotencyKey,
  getIdempotencyKeyRecord,
  releaseIdempotencyKey,
} from './idempotency'

type DbClient = SupabaseClient<Database>

describe('idempotency DAL', () => {
  it('claims a fresh key', async () => {
    const deleteLt = vi.fn().mockReturnValue({
      lt: vi.fn().mockResolvedValue({ error: null }),
    })
    const insertSingle = vi.fn().mockResolvedValue({
      data: { key: 'key-1' },
      error: null,
    })
    const db = {
      from: vi.fn((table: string) => {
        if (table !== 'idempotency_keys') throw new Error(`unexpected table ${table}`)
        return {
          delete: deleteLt,
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: insertSingle }),
          }),
        }
      }),
    } as unknown as DbClient

    const claimed = await checkAndClaimIdempotencyKey(db, 'key-1', 'invoice-payment')
    expect(claimed).toBe(true)
  })

  it('rejects duplicate keys within the TTL window', async () => {
    const deleteLt = vi.fn().mockReturnValue({
      lt: vi.fn().mockResolvedValue({ error: null }),
    })
    const insertSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })
    const db = {
      from: vi.fn(() => ({
        delete: deleteLt,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: insertSingle }),
        }),
      })),
    } as unknown as DbClient

    const claimed = await checkAndClaimIdempotencyKey(db, 'key-1', 'invoice-payment')
    expect(claimed).toBe(false)
  })

  it('reads an existing key record', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { resource_type: 'invoice-payment', resource_id: 'invoice-1' },
      error: null,
    })
    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ maybeSingle }),
        }),
      })),
    } as unknown as DbClient

    const record = await getIdempotencyKeyRecord(db, 'key-1')
    expect(record).toEqual({
      resourceType: 'invoice-payment',
      resourceId: 'invoice-1',
    })
  })

  it('releases a claimed key after failure', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const db = {
      from: vi.fn(() => ({
        delete: vi.fn().mockReturnValue({ eq: deleteEq }),
      })),
    } as unknown as DbClient

    await releaseIdempotencyKey(db, 'key-1')
    expect(deleteEq).toHaveBeenCalledWith('key', 'key-1')
  })
})