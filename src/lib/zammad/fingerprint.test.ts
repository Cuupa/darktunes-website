import { describe, expect, it } from 'vitest'
import { buildErrorFingerprint } from './fingerprint'

describe('buildErrorFingerprint', () => {
  it('returns stable 64-char hex hash', () => {
    const fp = buildErrorFingerprint('ui', 'Something broke', '/portal')
    expect(fp).toMatch(/^[a-f0-9]{64}$/)
    expect(buildErrorFingerprint('ui', 'Something broke', '/portal')).toBe(fp)
  })

  it('differs when source, message, or path changes', () => {
    const base = buildErrorFingerprint('ui', 'Error A', '/admin')
    expect(buildErrorFingerprint('api', 'Error A', '/admin')).not.toBe(base)
    expect(buildErrorFingerprint('ui', 'Error B', '/admin')).not.toBe(base)
    expect(buildErrorFingerprint('ui', 'Error A', '/portal')).not.toBe(base)
  })
})