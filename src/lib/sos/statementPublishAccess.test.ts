import { describe, expect, it } from 'vitest'
import { canPublishStatement } from './statementPublishAccess'

describe('canPublishStatement', () => {
  it('allows admins only', () => {
    expect(canPublishStatement('admin')).toBe(true)
  })

  it('rejects editors, artists, missing and unknown roles', () => {
    expect(canPublishStatement('editor')).toBe(false)
    expect(canPublishStatement('artist')).toBe(false)
    expect(canPublishStatement('user')).toBe(false)
    expect(canPublishStatement(null)).toBe(false)
    expect(canPublishStatement(undefined)).toBe(false)
  })
})
