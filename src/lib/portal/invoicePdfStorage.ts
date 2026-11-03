import { invoiceObjectKey } from '@/lib/r2/keys'

/** An internal storage reference, never a public URL. */
export const PRIVATE_INVOICE_KEY_PREFIX = 'r2-private:'

export function privateInvoiceReference(artistId: string, invoiceId: string, sha256: string): string {
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new Error('Valid invoice PDF SHA-256 required')
  return `${PRIVATE_INVOICE_KEY_PREFIX}invoices/${artistId}/${invoiceId}/${sha256.toLowerCase()}.pdf`
}

/**
 * New invoice PDFs must be stored in a separate bucket without a public domain.
 * Legacy URLs are still served from the original bucket until their objects
 * have been securely migrated and removed from the public bucket.
 */
export function resolveInvoicePdfObject(
  invoice: { id: string; artistId: string; pdfUrl?: string; pdfSha256?: string },
  config: {
    publicBucket: string
    privateBucket?: string
  },
): { bucket: string; key: string; isLegacyPublic: boolean } {
  const key = invoiceObjectKey(invoice.artistId, invoice.id)
  if (!invoice.pdfUrl) throw new Error('Invoice PDF is missing')
  if (invoice.pdfUrl.startsWith(PRIVATE_INVOICE_KEY_PREFIX)) {
    const expected = invoice.pdfSha256
      ? privateInvoiceReference(invoice.artistId, invoice.id, invoice.pdfSha256)
      : null
    if (invoice.pdfUrl !== expected) {
      throw new Error('Invoice PDF reference does not match the stored SHA-256')
    }
    if (!config.privateBucket || config.privateBucket === config.publicBucket) {
      throw new Error('Private invoice storage bucket is not configured')
    }
    return {
      key: invoice.pdfUrl.slice(PRIVATE_INVOICE_KEY_PREFIX.length),
      bucket: config.privateBucket,
      isLegacyPublic: false,
    }
  }
  // Historic invoice PDFs were written to the public assets bucket under
  // this canonical key. Do not trust the URL path itself as a storage key.
  return { key, bucket: config.publicBucket, isLegacyPublic: true }
}
