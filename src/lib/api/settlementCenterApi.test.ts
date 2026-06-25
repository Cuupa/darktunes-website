import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bulkApproveStatements,
  fetchSettlementRegister,
  markInvoiceReceived,
} from './settlementCenterApi'

describe('settlementCenterApi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchSettlementRegister returns parsed register data', async () => {
    const register = {
      period: { id: 'p1', status: 'open' },
      rows: [],
      kpis: {
        approved: 0,
        viewed: 0,
        invoiced: 0,
        received: 0,
        paid: 0,
        openBalanceEur: 0,
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => register,
      }),
    )

    const result = await fetchSettlementRegister('token', '2026-01-01', '2026-01-31', 'fallback')
    expect(result).toEqual(register)
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/settlements/register?periodStart=2026-01-01&periodEnd=2026-01-31',
      { headers: { Authorization: 'Bearer token' } },
    )
  })

  it('fetchSettlementRegister throws API error message when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Period not found' }),
      }),
    )

    await expect(
      fetchSettlementRegister('token', '2026-01-01', '2026-01-31', 'fallback'),
    ).rejects.toThrow('Period not found')
  })

  it('bulkApproveStatements posts statement ids', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ approved: 2, emailed: 1 }),
      }),
    )

    const result = await bulkApproveStatements('token', ['s1', 's2'], 'ok', 'fallback')
    expect(result).toEqual({ approved: 2, emailed: 1 })
    expect(fetch).toHaveBeenCalledWith('/api/admin/sales-statements/bulk-approve', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ['s1', 's2'], notes: 'ok' }),
    })
  })

  it('markInvoiceReceived uses fallback when response has no error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => null,
      }),
    )

    await expect(markInvoiceReceived('token', 'inv-1', 'mark failed')).rejects.toThrow(
      'mark failed',
    )
  })
})