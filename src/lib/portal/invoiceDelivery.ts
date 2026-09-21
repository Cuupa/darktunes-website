import type { ArtistInvoice } from '@/lib/api/artistInvoices'

export function canRetryInvoiceDelivery(
  invoice: Pick<ArtistInvoice, 'status' | 'pdfUrl' | 'deliveryStatus'>,
): { ok: true } | { ok: false; status: number; message: string } {
  if (invoice.status === 'cancelled' || invoice.status === 'paid') {
    return {
      ok: false,
      status: 409,
      message: `Cannot retry delivery for an invoice in status "${invoice.status}"`,
    }
  }
  if (!invoice.pdfUrl) {
    return { ok: false, status: 409, message: 'Invoice PDF is missing; delivery cannot be retried' }
  }
  if (invoice.status === 'sent' && invoice.deliveryStatus === 'sent') {
    return { ok: false, status: 409, message: 'Invoice was already delivered' }
  }
  if (invoice.status !== 'draft' && invoice.deliveryStatus !== 'failed') {
    return {
      ok: false,
      status: 409,
      message: 'Delivery retry is only available for draft invoices or failed sends',
    }
  }
  return { ok: true }
}
