import { describe, expect, it } from 'vitest'
import {
  decideInvoiceOperationReplay,
  hashInvoicePayload,
} from './invoiceOperation'

describe('hashInvoicePayload', () => {
  it('is stable across key order and ignores undefined values', () => {
    const a = hashInvoicePayload({ b: 2, a: 1, skip: undefined })
    const b = hashInvoicePayload({ a: 1, b: 2 })
    expect(a).toBe(b)
  })

  it('changes when a value changes', () => {
    const a = hashInvoicePayload({ amount: 100 })
    const b = hashInvoicePayload({ amount: 101 })
    expect(a).not.toBe(b)
  })

  it('distinguishes array order', () => {
    expect(hashInvoicePayload([1, 2])).not.toBe(hashInvoicePayload([2, 1]))
  })
})

describe('decideInvoiceOperationReplay', () => {
  it('continues when no operation exists', () => {
    expect(decideInvoiceOperationReplay(null, 'hash')).toBe('none')
  })

  it('replays when the payload matches and an invoice id is stored', () => {
    expect(
      decideInvoiceOperationReplay({ payloadHash: 'hash', invoiceId: 'inv-1' }, 'hash'),
    ).toBe('replay')
  })

  it('continues a matching operation that has no result yet (retry after partial failure)', () => {
    expect(decideInvoiceOperationReplay({ payloadHash: 'hash' }, 'hash')).toBe('none')
  })

  it('conflicts when the same operation id is reused with a different payload', () => {
    expect(
      decideInvoiceOperationReplay({ payloadHash: 'other', invoiceId: 'inv-1' }, 'hash'),
    ).toBe('conflict')
  })
})
