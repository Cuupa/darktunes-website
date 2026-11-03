import { describe, expect, it } from 'vitest'
import { privateInvoiceReference, resolveInvoicePdfObject } from './invoicePdfStorage'

describe('private invoice PDF storage', () => {
  const invoice = { id: 'inv-1', artistId: 'artist-1', pdfUrl: privateInvoiceReference('artist-1', 'inv-1') }
  const config = { publicBucket: 'public-assets', privateBucket: 'private-invoices' }

  it('stores new invoices under an opaque reference in a separate bucket', () => {
    expect(invoice.pdfUrl).toBe('r2-private:invoices/artist-1/inv-1.pdf')
    expect(resolveInvoicePdfObject(invoice, config)).toEqual({
      key: 'invoices/artist-1/inv-1.pdf',
      bucket: 'private-invoices',
      isLegacyPublic: false,
    })
  })

  it('fails closed without a separate bucket', () => {
    expect(() => resolveInvoicePdfObject(invoice, { publicBucket: 'public-assets' }))
      .toThrow(/not configured/)
    expect(() => resolveInvoicePdfObject(invoice, {
      publicBucket: 'public-assets', privateBucket: 'public-assets',
    })).toThrow(/not configured/)
  })

  it('rejects swapped private references', () => {
    expect(() => resolveInvoicePdfObject({
      ...invoice, pdfUrl: 'r2-private:invoices/other/inv-1.pdf',
    }, config)).toThrow(/does not match/)
  })

  it('preserves retrieval for legacy objects until migration', () => {
    const legacy = { ...invoice, pdfUrl: 'https://cdn.example/invoices/artist-1/inv-1.pdf' }
    expect(resolveInvoicePdfObject(legacy, config)).toMatchObject({
      bucket: 'public-assets', key: 'invoices/artist-1/inv-1.pdf', isLegacyPublic: true,
    })
  })
})
