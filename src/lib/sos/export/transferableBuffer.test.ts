import { describe, expect, it } from 'vitest'
import { toTransferableArrayBuffer } from './transferableBuffer'

describe('toTransferableArrayBuffer', () => {
  it('converts a Uint8Array into an ArrayBuffer that structuredClone can transfer', () => {
    const view = new Uint8Array([80, 75, 3, 4])
    const buffer = toTransferableArrayBuffer(view)
    expect(Object.prototype.toString.call(buffer)).toBe('[object ArrayBuffer]')
    expect(buffer).not.toBe(view.buffer)
    const cloned = structuredClone({ buffer }, { transfer: [buffer] })
    expect(Array.from(new Uint8Array(cloned.buffer))).toEqual([80, 75, 3, 4])
  })

  it('copies an ArrayBuffer so the result can be transferred', () => {
    const original = new Uint8Array([1, 2, 3]).buffer
    const copy = toTransferableArrayBuffer(original)
    expect(Object.prototype.toString.call(copy)).toBe('[object ArrayBuffer]')
    expect(copy).not.toBe(original)
    expect(Array.from(new Uint8Array(copy))).toEqual([1, 2, 3])
  })
})
