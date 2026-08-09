import { describe, expect, it, vi } from 'vitest'
import {
  coerceNonNegInt,
  parseAggregateSum,
  parseRpcStats,
  resolveCatalogStorageStats,
  sumSizeBytesPaginated,
} from './storageStats'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Db = SupabaseClient<Database>

describe('coerceNonNegInt', () => {
  it('coerces number string and bigint', () => {
    expect(coerceNonNegInt(12.9)).toBe(12)
    expect(coerceNonNegInt('2048000')).toBe(2048000)
    expect(coerceNonNegInt(BigInt(99))).toBe(99)
    expect(coerceNonNegInt(-3)).toBe(0)
    expect(coerceNonNegInt(null)).toBe(0)
  })
})

describe('parseRpcStats', () => {
  it('parses array row (legacy RETURNS TABLE)', () => {
    expect(parseRpcStats([{ used_bytes: '100', asset_count: '2', zero_size_count: '1' }])).toEqual({
      usedBytes: 100,
      assetCount: 2,
      zeroSizeCount: 1,
    })
  })

  it('parses JSON object (current function)', () => {
    expect(
      parseRpcStats({ used_bytes: 500, asset_count: 3, zero_size_count: 0 }),
    ).toEqual({ usedBytes: 500, assetCount: 3, zeroSizeCount: 0 })
  })

  it('parses JSON string payload', () => {
    expect(
      parseRpcStats(JSON.stringify({ used_bytes: 10, asset_count: 1, zero_size_count: 0 })),
    ).toEqual({ usedBytes: 10, assetCount: 1, zeroSizeCount: 0 })
  })

  it('returns null for empty array', () => {
    expect(parseRpcStats([])).toBeNull()
  })
})

describe('parseAggregateSum', () => {
  it('reads sum key from aggregate select', () => {
    expect(parseAggregateSum([{ sum: '999' }])).toBe(999)
  })
})

describe('sumSizeBytesPaginated', () => {
  it('sums pages', async () => {
    const range = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ size_bytes: 100 }, { size_bytes: 0 }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })

    // first page 2 rows < 1000 → stop after first
    range.mockReset()
    range.mockResolvedValue({
      data: [{ size_bytes: 100 }, { size_bytes: 50 }, { size_bytes: 0 }],
      error: null,
    })

    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range,
      }),
    } as unknown as Db

    const stats = await sumSizeBytesPaginated(db)
    expect(stats.usedBytes).toBe(150)
    expect(stats.assetCount).toBe(3)
    expect(stats.zeroSizeCount).toBe(1)
    expect(stats.source).toBe('paginated')
  })
})

describe('resolveCatalogStorageStats', () => {
  it('prefers RPC when available', async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({
        data: { used_bytes: 42, asset_count: 7, zero_size_count: 1 },
        error: null,
      }),
    } as unknown as Db

    const stats = await resolveCatalogStorageStats(db)
    expect(stats).toEqual({
      usedBytes: 42,
      assetCount: 7,
      zeroSizeCount: 1,
      source: 'rpc',
    })
  })

  it('falls back to aggregate then paginated', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [{ size_bytes: 10 }],
      error: null,
    })
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockImplementation((sel: string, opts?: { head?: boolean }) => {
        if (typeof sel === 'string' && sel.includes('sum')) {
          return Promise.resolve({ data: null, error: { message: 'agg off' } })
        }
        if (opts?.head) {
          return {
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            then: undefined,
            count: 1,
            error: null,
          }
        }
        return {
          order: vi.fn().mockReturnThis(),
          range,
          eq: vi.fn().mockReturnThis(),
        }
      }),
      order: vi.fn().mockReturnThis(),
      range,
    })

    const db = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'no rpc' } }),
      from,
    } as unknown as Db

    // When aggregate fails, paginated is used
    const stats = await resolveCatalogStorageStats(db)
    expect(stats.source).toBe('paginated')
    expect(stats.usedBytes).toBe(10)
  })
})
