/**
 * src/lib/portal/invoiceNumber.test.ts
 *
 * Unit tests for the sequential invoice number generator.
 */

import { describe, it, expect, vi } from 'vitest'
import { generateInvoiceNumber } from './invoiceNumber'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function makeMockSupabase(rows: { invoice_number: string }[]) {
  const single = vi.fn()
  const limit = vi.fn().mockReturnValue({ data: rows, error: null })
  const order = vi.fn().mockReturnValue({ limit })
  const ilike = vi.fn().mockReturnValue({ order })
  const eq = vi.fn().mockReturnValue({ ilike })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  void single
  return { from } as unknown as SupabaseClient<Database>
}

describe('generateInvoiceNumber', () => {
  const artistId = 'artist-uuid-123'

  it('generates DT-{YEAR}-0001 when no existing invoices', async () => {
    const supabase = makeMockSupabase([])
    const year = 2025
    const result = await generateInvoiceNumber(supabase, artistId, year)
    expect(result).toBe('DT-2025-0001')
  })

  it('increments from the last existing invoice number', async () => {
    const supabase = makeMockSupabase([{ invoice_number: 'DT-2025-0007' }])
    const result = await generateInvoiceNumber(supabase, artistId, 2025)
    expect(result).toBe('DT-2025-0008')
  })

  it('pads sequence to 4 digits', async () => {
    const supabase = makeMockSupabase([{ invoice_number: 'DT-2025-0099' }])
    const result = await generateInvoiceNumber(supabase, artistId, 2025)
    expect(result).toBe('DT-2025-0100')
  })

  it('rolls over correctly at 999', async () => {
    const supabase = makeMockSupabase([{ invoice_number: 'DT-2025-0999' }])
    const result = await generateInvoiceNumber(supabase, artistId, 2025)
    expect(result).toBe('DT-2025-1000')
  })

  it('uses current year when year not provided', async () => {
    const supabase = makeMockSupabase([])
    const result = await generateInvoiceNumber(supabase, artistId)
    const currentYear = new Date().getFullYear()
    expect(result).toBe(`DT-${currentYear}-0001`)
  })

  it('throws when supabase returns error', async () => {
    const limit = vi.fn().mockReturnValue({ data: null, error: { message: 'DB error' } })
    const order = vi.fn().mockReturnValue({ limit })
    const ilike = vi.fn().mockReturnValue({ order })
    const eq = vi.fn().mockReturnValue({ ilike })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    const supabase = { from } as unknown as SupabaseClient<Database>

    await expect(generateInvoiceNumber(supabase, artistId, 2025)).rejects.toThrow('DB error')
  })
})
