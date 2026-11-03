import { describe, expect, it } from 'vitest'
import { parseShopifyRaw, reconcileMerchTransactions } from './ecommerce-merger'
import { parsePrintfulCSV } from './printful-parser'

const SHOPIFY_HEADER =
  'Name,Lineitem name,Lineitem sku,Lineitem quantity,Lineitem price,Subtotal,Currency,Paid at,Billing Country'

describe('parseShopifyRaw strict amounts (#632)', () => {
  it('keeps a zero quantity instead of fabricating a sale', () => {
    const csv = [
      SHOPIFY_HEADER,
      'DM1001,Reaper - Nightfall,SKU1,0,9.99,0,EUR,2026-01-05,Germany',
    ].join('\n')

    const result = parseShopifyRaw(csv)
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0]?.salesMonth).toBe('2026-01')
    expect(result.orders[0]?.lineItems[0]?.quantity).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('keeps negative refund quantities', () => {
    const csv = [
      SHOPIFY_HEADER,
      'DM1002,Reaper - Nightfall,SKU1,-1,9.99,-9.99,EUR,2026-01-05,Germany',
    ].join('\n')

    const result = parseShopifyRaw(csv)
    expect(result.orders[0]?.lineItems[0]?.quantity).toBe(-1)
    expect(result.orders[0]?.subtotal).toBe(-9.99)
  })

  it('reports an invalid quantity and skips the line item', () => {
    const csv = [
      SHOPIFY_HEADER,
      'DM1003,Reaper - Nightfall,SKU1,abc,9.99,9.99,EUR,2026-01-05,Germany',
    ].join('\n')

    const result = parseShopifyRaw(csv)
    expect(result.orders).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.reason).toContain('Lineitem quantity')
    expect(result.errors[0]?.reason).toContain('abc')
  })

  it('parses EN thousands in prices', () => {
    const csv = [
      SHOPIFY_HEADER,
      'DM1004,Reaper - Box Set,SKU1,1,"1,234.56","1,234.56",EUR,2026-01-05,Germany',
    ].join('\n')

    const result = parseShopifyRaw(csv)
    expect(result.orders[0]?.lineItems[0]?.unitPrice).toBe(1234.56)
    expect(result.orders[0]?.subtotal).toBe(1234.56)
  })
})

describe('parsePrintfulCSV strict amounts (#632)', () => {
  it('parses a currency symbol with an EN decimal', () => {
    const csv = ['Order,Total,Status', '#DM1063,€15.79,fulfilled'].join('\n')

    const result = parsePrintfulCSV(csv)
    expect(result.costs).toEqual([{ orderId: '#DM1063', total: 15.79, currency: 'EUR' }])
    expect(result.errors).toHaveLength(0)
  })

  it('derives archive provenance from Printful dates without changing the cost data', () => {
    const csv = ['Order,Total,Date', '#DM1063,15.79,31/12/2025', '#DM1064,9.50,01/03/2026'].join('\n')
    const result = parsePrintfulCSV(csv)
    expect(result.costs).toEqual([{ orderId: '#DM1063', total: 15.79 }, { orderId: '#DM1064', total: 9.5 }])
    expect(result.periodMonths).toEqual(['2025-12', '2026-03'])
  })

  it('reports an invalid total instead of using 0', () => {
    const csv = ['Order,Total,Status', '#DM1064,abc,fulfilled'].join('\n')

    const result = parsePrintfulCSV(csv)
    expect(result.costs).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.reason).toContain('Total')
  })
})

describe('reconcileMerchTransactions overlap handling (#631)', () => {
  it('sums multiple Printful costs for the same order instead of last-wins', () => {
    const shopify = parseShopifyRaw(
      [
        SHOPIFY_HEADER,
        'DM2001,Reaper - Nightfall,SKU1,1,100,100,EUR,2026-01-05,Germany',
      ].join('\n'),
    )
    const printful = parsePrintfulCSV(
      ['Order,Total,Currency,Status', '#DM2001,15,EUR,fulfilled', 'DM2001,5,EUR,fulfilled'].join('\n'),
    )

    const { transactions } = reconcileMerchTransactions(shopify.orders, printful.costs)

    expect(transactions).toHaveLength(1)
    // 100 subtotal − (15 + 5) fulfilment costs
    expect(transactions[0]?.net_revenue).toBeCloseTo(80, 6)
  })

  it('keeps self-fulfilled orders without Printful costs at full net revenue', () => {
    const shopify = parseShopifyRaw(
      [
        SHOPIFY_HEADER,
        'DM2002,Reaper - Nightfall,SKU1,1,50,50,EUR,2026-01-05,Germany',
      ].join('\n'),
    )

    const { transactions } = reconcileMerchTransactions(shopify.orders, [])
    expect(transactions[0]?.net_revenue).toBeCloseTo(50, 6)
  })
})

describe('e-commerce cost currency protection', () => {
  const shopify = parseShopifyRaw([
    SHOPIFY_HEADER,
    'DM2026,Reaper - Shirt,S1,1,100,100,EUR,2026-02-05,Germany',
  ].join('\n')).orders

  it('blocks a matched cost with no explicit currency', () => {
    const costs = parsePrintfulCSV('Order,Total\nDM2026,15').costs
    expect(costs[0]?.currency).toBeUndefined()
    expect(() => reconcileMerchTransactions(shopify, costs)).toThrow(/currency is missing/i)
  })

  it('blocks a USD Printful cost against EUR Shopify revenue', () => {
    const costs = parsePrintfulCSV('Order,Total,Currency\nDM2026,15,USD').costs
    expect(costs[0]?.currency).toBe('USD')
    expect(() => reconcileMerchTransactions(shopify, costs)).toThrow(/Shopify EUR and Printful USD differ/)
  })

  it('blocks mixed currencies for multiple cost rows on the same order', () => {
    const costs = parsePrintfulCSV('Order,Total,Currency\nDM2026,15,EUR\nDM2026,5,USD').costs
    expect(() => reconcileMerchTransactions(shopify, costs)).toThrow(/inconsistent currency/i)
  })

  it('correctly subtracts explicitly matching EUR costs', () => {
    const costs = parsePrintfulCSV('Order,Total,Currency\nDM2026,15,EUR').costs
    expect(reconcileMerchTransactions(shopify, costs).transactions[0]?.net_revenue).toBeCloseTo(85)
  })

  it('refuses missing or internally contradictory Shopify currency codes', () => {
    const noCurrency = parseShopifyRaw([SHOPIFY_HEADER, 'DM1,Reaper - Shirt,S1,1,100,100,,2026-02-05,Germany'].join('\n'))
    expect(noCurrency.errors[0]?.reason).toMatch(/Currency/)
    const mixed = parseShopifyRaw([
      SHOPIFY_HEADER,
      'DM1,Reaper - Shirt,S1,1,100,100,EUR,2026-02-05,Germany',
      'DM1,Reaper - Shirt,S2,1,10,10,USD,2026-02-05,Germany',
    ].join('\n'))
    expect(mixed.errors[0]?.reason).toMatch(/Conflicting currencies/)
  })
})
