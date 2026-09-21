import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getArtistInvoice = vi.fn()
const updateInvoice = vi.fn()
const sendInvoiceEmail = vi.fn()
const getEmailCredentials = vi.fn()

vi.mock('@/lib/api/artistInvoices', () => ({
  getArtistInvoice: (...args: unknown[]) => getArtistInvoice(...args),
  updateInvoice: (...args: unknown[]) => updateInvoice(...args),
}))

vi.mock('@/lib/email/sendInvoiceEmail', () => ({
  sendInvoiceEmail: (...args: unknown[]) => sendInvoiceEmail(...args),
}))

vi.mock('@/lib/secrets/getExternalCredentials', () => ({
  getEmailCredentials: (...args: unknown[]) => getEmailCredentials(...args),
}))

vi.mock('@/lib/env.server', () => ({
  serverEnv: { API_CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64) },
}))

vi.mock('@/lib/portal/withPortalMembership', () => ({
  withPortalMembershipWrite: vi.fn(async () => ({
    artist: { id: '11111111-1111-4111-8111-111111111111', name: 'Frozen Plasma' },
    serviceDb: { kind: 'service' },
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

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    artistId: ARTIST_ID,
    invoiceNumber: 'DT-2026-0001',
    artistInvoiceNumber: 'SOS-2026-01',
    clientName: 'darkTunes',
    clientEmail: 'finance@label.test',
    status: 'draft',
    pdfUrl: 'r2://invoices/x.pdf',
    deliveryStatus: 'failed',
    deliveryError: 'HTTP 401',
    ...overrides,
  }
}

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/portal/invoices/[id]/deliveries/route')
}

function post() {
  return new NextRequest(`http://localhost/api/portal/invoices/${INVOICE_ID}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify({ artist_id: ARTIST_ID }),
  })
}

describe('POST /api/portal/invoices/{id}/deliveries', () => {
  beforeEach(() => {
    getArtistInvoice.mockReset()
    updateInvoice.mockReset()
    sendInvoiceEmail.mockReset()
    getEmailCredentials.mockResolvedValue({ resendApiKey: 'key', resendFromEmail: 'from@test' })
  })

  it('sends from the persisted invoice and marks sent', async () => {
    getArtistInvoice.mockResolvedValue(invoice())
    sendInvoiceEmail.mockResolvedValue({ success: true })
    updateInvoice.mockResolvedValue(invoice({ status: 'sent', deliveryStatus: 'sent', deliveryError: null }))

    const { POST } = await loadRoute()
    const response = await POST(post())
    const json = await response.json() as { email_sent: boolean; invoice: { status: string } }

    expect(response.status).toBe(200)
    expect(json.email_sent).toBe(true)
    expect(json.invoice.status).toBe('sent')
    expect(sendInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEmail: 'finance@label.test',
        invoiceNumber: 'SOS-2026-01',
      }),
      expect.any(Object),
    )
  })

  it('keeps draft when the retry send fails', async () => {
    getArtistInvoice.mockResolvedValue(invoice())
    sendInvoiceEmail.mockResolvedValue({ success: false, error: 'SMTP down' })
    updateInvoice.mockResolvedValue(invoice({ deliveryError: 'SMTP down' }))

    const { POST } = await loadRoute()
    const response = await POST(post())
    const json = await response.json() as { email_sent: boolean; email_error: string }

    expect(json.email_sent).toBe(false)
    expect(json.email_error).toBe('SMTP down')
    expect(updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      INVOICE_ID,
      ARTIST_ID,
      expect.objectContaining({ status: 'draft', delivery_status: 'failed' }),
    )
  })

  it('rejects a paid invoice', async () => {
    getArtistInvoice.mockResolvedValue(invoice({ status: 'paid', deliveryStatus: 'sent' }))
    const { POST } = await loadRoute()
    const response = await POST(post())
    expect(response.status).toBe(409)
    expect(sendInvoiceEmail).not.toHaveBeenCalled()
  })
})
