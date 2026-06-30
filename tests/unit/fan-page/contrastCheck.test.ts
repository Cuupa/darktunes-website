import { describe, expect, it } from 'vitest'
import { checkContrast, getContrastRatio } from '@/lib/fan-page/a11y/contrastCheck'

describe('contrastCheck', () => {
  it('returns high ratio for black on white', () => {
    const ratio = getContrastRatio('#000000', '#ffffff')
    expect(ratio).not.toBeNull()
    expect(ratio!).toBeGreaterThan(10)
  })

  it('flags low-contrast pairs', () => {
    const result = checkContrast('#cccccc', '#dddddd')
    expect(result?.level).toBe('fail')
  })

  it('passes WCAG AA for readable pairs', () => {
    const result = checkContrast('#ffffff', '#0a0a0a')
    expect(result?.level).toMatch(/pass/)
  })
})