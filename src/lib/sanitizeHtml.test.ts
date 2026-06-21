import DOMPurify from 'dompurify'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('always includes target in ADD_ATTR without caller options', () => {
    const spy = vi.spyOn(DOMPurify, 'sanitize').mockImplementation((html) => String(html))

    sanitizeHtml('<a target="_blank" href="https://example.com">link</a>')

    expect(spy).toHaveBeenCalledWith(
      '<a target="_blank" href="https://example.com">link</a>',
      expect.objectContaining({ ADD_ATTR: ['target'] }),
    )
  })

  it('keeps caller options and merges target into ADD_ATTR', () => {
    const spy = vi.spyOn(DOMPurify, 'sanitize').mockImplementation((html) => String(html))

    sanitizeHtml('<a href="https://example.com">link</a>', {
      ALLOWED_TAGS: ['a'],
      ALLOWED_ATTR: ['href', 'rel'],
      ADD_ATTR: ['rel'],
    })

    expect(spy).toHaveBeenCalledWith(
      '<a href="https://example.com">link</a>',
      expect.objectContaining({
        ALLOWED_TAGS: ['a'],
        ALLOWED_ATTR: ['href', 'rel'],
        ADD_ATTR: ['target', 'rel'],
      }),
    )
  })
})
