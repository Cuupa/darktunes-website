import { invoiceObjectKey } from '@/lib/r2/keys'

/** An internal storage reference, never a public URL. */
export const PRIVATE_INVOICE_KEY_PREFIX = 'r2-private:'

export function privateInvoiceReference(artistId: string, invoiceId: string): string {
  return `${PRIVATE_INVOICE_KEY_PREFIX}${invoiceObjectKey(artistId, invoiceId)}`
}

/**
 * New invoice PDFs must be stored in a separate bucket without a public domain.
 * Legacy URLs are still served from the original bucket until their objects
 * have been securely migrated and removed from the public bucket.
 */
export function resolveInvoicePdfObject(
  invoice: { id: string; artistId: string; pdfUrl?: string },
  config: {
    publicBucket: string
    privateBucket?: string
  },
): { bucket: string; key: string; isLegacyPublic: boolean } {
  const key = invoiceObjectKey(invoice.artistId, invoice.id)
  if (!invoice.pdfUrl) throw new Error('Invoice PDF is missing')
  if (invoice.pdfUrl.startsWith(PRIVATE_INVOICE_KEY_PREFIX)) {
    if (invoice.pdfUrl !== `${PRIVATE_INVOICE_KEY_PREFIX}${key}`) {
      throw new Error('Invoice PDF reference does not match the invoice')
    }
    if (!config.privateBucket || config.privateBucket === config.publicBucket) {
      throw new Error('Private invoice storage bucket is not configured')
    }
    return { key, bucket: config.privateBucket, isLegacyPublic: false }
  }
  // Historic invoice PDFs were written to the public assets bucket under
  // this canonical key. Do not trust the URL path itself as a storage key.
  return { key, bucket: config.publicBucket, isLegacyPublic: true }
}
