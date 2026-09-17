import { describe, expect, it } from 'vitest'
import { parseDarkmerchCSV } from './darkmerch-parser'

const CSV = ['DATE,BAND,NET REVENUE', 'Q1 2026,Reaper,5', 'Q1 2026,Lamori,8'].join('\n')

describe('parseDarkmerchCSV original cells', () => {
  it('keeps original headers and cell strings on each row', () => {
    const result = parseDarkmerchCSV(CSV)
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]?.source_headers).toEqual(['DATE', 'BAND', 'NET REVENUE'])
    expect(result.transactions[0]?.source_values).toEqual(['Q1 2026', 'Reaper', '5'])
    expect(result.transactions[0]?.source_row_id).toBe(result.transactions[0]?.id)
    expect(result.transactions[0]?.source_headers).toBe(result.transactions[1]?.source_headers)
  })

  it('does not reuse row ids across two parses of the same file', () => {
    const first = parseDarkmerchCSV(CSV)
    const second = parseDarkmerchCSV(CSV)
    const firstIds = new Set(first.transactions.map((tx) => tx.id))
    for (const tx of second.transactions) {
      expect(firstIds.has(tx.id)).toBe(false)
    }
  })
})

describe('parseDarkmerchCSV number formats (#632)', () => {
  it('parses German decimal comma without a factor-100 error', () => {
    const csv = ['DATE;BAND;NET REVENUE', 'Q1 2026;Reaper;15,79', 'Q1 2026;Lamori;1.234,56'].join('\n')
    const result = parseDarkmerchCSV(csv)
    expect(result.transactions.map((tx) => tx.net_revenue)).toEqual([15.79, 1234.56])
    expect(result.errors).toHaveLength(0)
  })

  it('reports invalid revenue values instead of coercing them to 0', () => {
    const csv = ['DATE,BAND,NET REVENUE', 'Q1 2026,Reaper,12x', 'Q1 2026,Lamori,15.79'].join('\n')
    const result = parseDarkmerchCSV(csv)
    expect(result.transactions).toHaveLength(0)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]?.reason).toContain('NET REVENUE')
    expect(result.errors[0]?.reason).toContain('12x')
  })
})
