import { describe, expect, it } from 'vitest'
import { isFieldVisible } from './visibilityCondition'

describe('isFieldVisible', () => {
  it('hides author when instrumental is true', () => {
    const condition = { field: 'instrumental', op: 'neq' as const, value: 'true' }
    expect(isFieldVisible(condition, { instrumental: 'true' })).toBe(false)
    expect(isFieldVisible(condition, { instrumental: 'false' })).toBe(true)
    expect(isFieldVisible(condition, {})).toBe(true)
  })
})
