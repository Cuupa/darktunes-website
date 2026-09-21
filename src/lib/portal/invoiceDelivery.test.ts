import { describe, expect, it } from 'vitest'
import { canRetryInvoiceDelivery } from './invoiceDelivery'

describe('canRetryInvoiceDelivery', () => {
  it('allows a draft with a PDF after a failed send', () => {
    expect(
      canRetryInvoiceDelivery({
        status: 'draft',
        pdfUrl: 'r2://invoice.pdf',
        deliveryStatus: 'failed',
      }),
    ).toEqual({ ok: true })
  })

  it('rejects paid or cancelled invoices', () => {
    expect(
      canRetryInvoiceDelivery({ status: 'paid', pdfUrl: 'r2://x', deliveryStatus: 'sent' }),
    ).toMatchObject({ ok: false, status: 409 })
    expect(
      canRetryInvoiceDelivery({ status: 'cancelled', pdfUrl: 'r2://x', deliveryStatus: 'failed' }),
    ).toMatchObject({ ok: false, status: 409 })
  })

  it('rejects a successful send', () => {
    expect(
      canRetryInvoiceDelivery({ status: 'sent', pdfUrl: 'r2://x', deliveryStatus: 'sent' }),
    ).toMatchObject({ ok: false, status: 409 })
  })

  it('rejects retry when the PDF is missing', () => {
    expect(
      canRetryInvoiceDelivery({ status: 'draft', pdfUrl: undefined, deliveryStatus: 'failed' }),
    ).toMatchObject({ ok: false, status: 409 })
  })
})
