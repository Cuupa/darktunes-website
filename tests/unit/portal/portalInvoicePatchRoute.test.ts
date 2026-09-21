import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getArtistInvoice = vi.fn()
const updateInvoice = vi.fn()

vi.mock('@/lib/api/artistInvoices', () => ({
  getArtistInvoice: (...args: unknown[]) => getArtistInvoice(...args),
  updateInvoice: (...args: unknown[]) => updateInvoice(...args),
}))

vi.mock('@/lib/portal/withPortalMembership', () => ({
  withPortalMembershipWrite: vi.fn(async () => ({
    artist: { id: '11111111-1111-4111-8111-111111111111', name: 'Frozen Plasma' },
    serviceDb: {},
    user: { id: 'user-1' },
    userDb: {},
  })),
  portalMemberWrite: vi.fn(
    async (
      _ctx: unknown,
      _meta: unknown,
      fn: (db: unknown) => Promise<unknown>,
    ) => ({ value: await fn({ kind: 'db' }) }),
  ),
}))

const ARTIST_ID = '11111111-1111-4111-8111-111111111111'
const INVOICE_ID = '44444444-4444-4444-8444-444444444444'

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/invoices/[id]/route')
}

function patch(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/portal/invoices/${INVOICE_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/portal/invoices/{id}', () => {
  beforeEach(() => {
    getArtistInvoice.mockReset()
    updateInvoice.mockReset()
  })

  it('rejects artist paid without going through the payment RPC', async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(patch({ artist_id: ARTIST_ID, status: 'paid' }))
    expect(response.status).toBe(400)
    expect(updateInvoice).not.toHaveBeenCalled()
  })

  it('cancels a draft invoice', async () => {
    getArtistInvoice.mockResolvedValue({
      id: INVOICE_ID,
      artistId: ARTIST_ID,
      status: 'draft',
      paidAmountCents: 0,
    })
    updateInvoice.mockResolvedValue({ id: INVOICE_ID, status: 'cancelled', paidAmountCents: 0 })

    const { PATCH } = await loadRoute()
    const response = await PATCH(patch({ artist_id: ARTIST_ID, status: 'cancelled' }))
    const json = await response.json() as { invoice: { status: string } }

    expect(response.status).toBe(200)
    expect(json.invoice.status).toBe('cancelled')
  })

  it('rejects cancelling a sent invoice', async () => {
    getArtistInvoice.mockResolvedValue({
      id: INVOICE_ID,
      artistId: ARTIST_ID,
      status: 'sent',
      paidAmountCents: 0,
    })
    const { PATCH } = await loadRoute()
    const response = await PATCH(patch({ artist_id: ARTIST_ID, status: 'cancelled' }))
    expect(response.status).toBe(409)
    expect(updateInvoice).not.toHaveBeenCalled()
  })
})
