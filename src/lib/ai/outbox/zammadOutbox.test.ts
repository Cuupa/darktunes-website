import { describe, expect, it } from 'vitest'
import { drainZammadOutbox } from '@/lib/ai/outbox/zammadOutbox'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

describe('drainZammadOutbox', () => {
  it('should skip a row another worker already claimed', async () => {
    const claims: Array<Record<string, unknown>> = []
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => ({
              lte: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [{ id: 'row-1', payload: { subject: 'x' }, attempts: 0 }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            in: () => ({
              lte: () => ({
                select: async () => {
                  claims.push(patch)
                  return { data: [], error: null }
                },
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>

    const sent = await drainZammadOutbox(db)
    expect(sent).toBe(0)
    expect(claims).toEqual([
      expect.objectContaining({ status: 'sending', next_retry_at: expect.any(String) }),
    ])
  })
})
