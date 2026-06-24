import { describe, expect, it } from 'vitest'
import { buildMerchOrderRows } from './merchOrderRows'
import type { SalesTransaction } from '@/lib/sos/ingest/csv-parser'

function tx(partial: Partial<SalesTransaction> & Pick<SalesTransaction, 'id' | 'source'>): SalesTransaction {
  return {
    sales_month: '2024-03',
    platform: 'Shopify',
    country: 'DE',
    main_artist: 'Band A',
    original_artist: 'Band A',
    release_title: 'T-Shirt',
    track_title: '',
    upc_ean: '',
    isrc: '',
    catalog_number: '',
    quantity: 2,
    net_revenue: 49.9,
    currency: 'EUR',
    is_physical: true,
    ...partial,
  }
}

describe('buildMerchOrderRows', () => {
  it('extracts shopify and darkmerch transactions only', () => {
    const rows = buildMerchOrderRows([
      tx({ id: 's1', source: 'shopify' }),
      tx({ id: 'd1', source: 'darkmerch', release_title: 'Hoodie' }),
      tx({ id: 'b1', source: 'believe', net_revenue: 1 }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]?.source).toBe('shopify')
    expect(rows[1]?.productTitle).toBe('Hoodie')
  })

  it('skips rows with invalid sales month', () => {
    const rows = buildMerchOrderRows([
      tx({ id: 's1', source: 'shopify', sales_month: 'Unknown' }),
    ])
    expect(rows).toHaveLength(0)
  })
})