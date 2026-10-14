/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml on the server', () => {
  it('strips an svg onload payload before it can reach the page', () => {
    const out = sanitizeHtml('<svg/onload=alert(1)>')
    expect(out.toLowerCase()).not.toContain('onload')
    expect(out.toLowerCase()).not.toContain('alert')
  })

  it('drops a javascript link written with an entity', () => {
    const out = sanitizeHtml('<a href="javascript&#58;alert(1)">listen</a>')
    expect(out.toLowerCase()).not.toContain('javascript')
    expect(out.toLowerCase()).not.toContain('alert')
    expect(out).toContain('listen')
  })

  it('keeps an allowed iframe and removes any other', () => {
    const out = sanitizeHtml(
      '<iframe src="https://www.youtube.com/embed/abc"></iframe><iframe src="https://evil.example/x"></iframe>',
      { ADD_TAGS: ['iframe'] },
    )
    expect(out).toContain('youtube.com')
    expect(out).not.toContain('evil.example')
  })
})
