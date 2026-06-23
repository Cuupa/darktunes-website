import { describe, expect, it } from 'vitest'
import { hashSharePassword, verifySharePassword } from './sharePassword'

describe('sharePassword', () => {
  it('hashes and verifies a password', () => {
    const hash = hashSharePassword('secret-epk')
    expect(hash).toContain(':')
    expect(verifySharePassword('secret-epk', hash)).toBe(true)
    expect(verifySharePassword('wrong', hash)).toBe(false)
  })
})