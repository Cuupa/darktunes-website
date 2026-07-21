import { describe, expect, it } from 'vitest'
import { sanitizeThemeCss } from './sanitizeThemeCss'

describe('sanitizeThemeCss', () => {
  it('allows ordinary CSS rules', () => {
    const css = ':root { --accent: #f00; } .hero { color: red; }'
    expect(sanitizeThemeCss(css)).toBe(css)
  })

  it('rejects style breakout payloads', () => {
    expect(sanitizeThemeCss('</style><script>alert(1)</script><style>')).toBe('')
  })

  it('rejects script tags and javascript URLs', () => {
    expect(sanitizeThemeCss('body { background: url(javascript:alert(1)); }')).toBe('')
    expect(sanitizeThemeCss('<script>evil()</script>')).toBe('')
  })

  it('rejects @import', () => {
    expect(sanitizeThemeCss('@import url("https://evil.example/x.css");')).toBe('')
  })

  it('returns empty for nullish input', () => {
    expect(sanitizeThemeCss(null)).toBe('')
    expect(sanitizeThemeCss(undefined)).toBe('')
    expect(sanitizeThemeCss('')).toBe('')
  })
})
