import { describe, expect, it } from 'vitest'
import { computeMerchOrderStats } from './merchOrders'
import type { MerchOrder } from './merchOrders'

function order(partial: Partial<MerchOrder> & Pick<MerchOrder, 'id'>): MerchOrder {
  return {
    artistId: 'a1',
    source: 'shopify',
    externalId: partial.id,
    period: '2024-01',
    productTitle: 'Shirt',
    country: 'DE',
    quantity: 1,
    revenueEur: 20,
    sourceBatchId: null,
    createdAt: '2024-01-01T00:00:00Z',
    ...partial,
  }
}

describe('computeMerchOrderStats', () => {
  it('aggregates revenue, quantity, and top products', () => {
    const stats = computeMerchOrderStats([
      order({ id: '1', productTitle: 'Shirt', quantity: 2, revenueEur: 40 }),
      order({ id: '2', productTitle: 'Hoodie', quantity: 1, revenueEur: 60, source: 'darkmerch' }),
    ])

    expect(stats.totalOrders).toBe(2)
    expect(stats.totalQuantity).toBe(3)
    expect(stats.totalRevenueEur).toBe(100)
    expect(stats.bySource.shopify).toBe(1)
    expect(stats.bySource.darkmerch).toBe(1)
    expect(stats.topProducts[0]?.productTitle).toBe('Hoodie')
  })
})