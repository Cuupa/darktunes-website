import { describe, it, expect } from 'vitest'
import {
  normalizeRichTextHtml,
  TIPTAP_EDITOR_CONTENT_CLASS,
  RICH_TEXT_CONTENT_CLASS,
} from './richTextContent'

describe('normalizeRichTextHtml', () => {
  it('converts empty paragraphs to br placeholders', () => {
    expect(normalizeRichTextHtml('<p>First</p><p></p><p>Second</p>')).toBe(
      '<p>First</p><p><br></p><p>Second</p>',
    )
  })

  it('normalizes Tiptap trailing-break paragraphs', () => {
    expect(
      normalizeRichTextHtml(
        '<p>Line one</p><p><br class="ProseMirror-trailingBreak"></p><p>Line two</p>',
      ),
    ).toBe('<p>Line one</p><p><br></p><p>Line two</p>')
  })

  it('leaves regular paragraphs unchanged', () => {
    const html = '<p>Paragraph one</p><p>Paragraph two</p>'
    expect(normalizeRichTextHtml(html)).toBe(html)
  })
})

describe('editor list styling', () => {
  it('uses outside markers and inline list-item paragraphs in the editor', () => {
    expect(TIPTAP_EDITOR_CONTENT_CLASS).toContain('[&_ul]:list-outside')
    expect(TIPTAP_EDITOR_CONTENT_CLASS).toContain('[&_li>p]:mb-0')
  })

  it('keeps public rich text lists on the same line as markers', () => {
    expect(RICH_TEXT_CONTENT_CLASS).toContain('[&_ol]:list-outside')
    expect(RICH_TEXT_CONTENT_CLASS).toContain('[&_li>p]:mb-0')
  })
})