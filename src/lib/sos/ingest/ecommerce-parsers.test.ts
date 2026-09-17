import { describe, expect, it } from 'vitest'
import { parseShopifyRaw } from './ecommerce-merger'
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
    expect(result.costs).toEqual([{ orderId: '#DM1063', total: 15.79 }])
    expect(result.errors).toHaveLength(0)
  })

  it('reports an invalid total instead of using 0', () => {
    const csv = ['Order,Total,Status', '#DM1064,abc,fulfilled'].join('\n')

    const result = parsePrintfulCSV(csv)
    expect(result.costs).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.reason).toContain('Total')
  })
})
