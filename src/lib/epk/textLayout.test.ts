import { describe, expect, it } from 'vitest'
import { snapValue, wrapTextToLines } from './textLayout'

describe('textLayout', () => {
  it('wraps long lines by measured width', () => {
    const lines = wrapTextToLines(
      'hello world from darktunes',
      (line) => line.length * 10,
      80,
    )
    expect(lines.length).toBeGreaterThan(1)
  })

  it('snaps values to grid when enabled', () => {
    expect(snapValue(17, 16, true)).toBe(16)
    expect(snapValue(17, 16, false)).toBe(17)
  })
})