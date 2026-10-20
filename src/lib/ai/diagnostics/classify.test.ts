import { describe, expect, it } from 'vitest'
import { classifyError, isSoftwareDefect } from '@/lib/ai/diagnostics/classify'

describe('classifyError', () => {
  it('should treat validation and 403 as non-defects', () => {
    expect(classifyError({ httpStatus: 400, message: 'Invalid JSON body' })).toBe('user_validation')
    expect(classifyError({ httpStatus: 403, message: 'Forbidden' })).toBe('permission')
    expect(isSoftwareDefect('user_validation')).toBe(false)
  })

  it('should treat 500 and storage failures as defects', () => {
    expect(classifyError({ httpStatus: 500, message: 'boom' })).toBe('server')
    expect(classifyError({ httpStatus: 500, message: 'R2 upload failed', source: 'r2' })).toBe('storage')
    expect(isSoftwareDefect('server')).toBe(true)
  })
})
