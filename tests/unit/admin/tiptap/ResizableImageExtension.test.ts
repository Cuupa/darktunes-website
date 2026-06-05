/**
 * Unit tests for ResizableImageExtension
 *
 * Tests the renderHTML → parseHTML round-trip for all four custom attributes.
 * We use @tiptap/core directly without a browser/DOM renderer for speed.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { ResizableImageExtension } from '../../../../src/components/admin/tiptap/ResizableImageExtension'

function makeEditor() {
  return new Editor({
    extensions: [StarterKit, ResizableImageExtension],
    content: '',
  })
}

describe('ResizableImageExtension', () => {
  let editor: Editor

  beforeEach(() => {
    editor = makeEditor()
  })

  it('inserts a resizableImage node via setResizableImage command', () => {
    editor.commands.setResizableImage({
      src: 'https://example.com/test.jpg',
      alt: 'Test image',
    })
    const doc = editor.state.doc
    let found = false
    doc.descendants((node) => {
      if (node.type.name === 'resizableImage') found = true
    })
    expect(found).toBe(true)
  })

  it('round-trips data-float attribute through renderHTML / HTML content', () => {
    editor.commands.setResizableImage({
      src: 'https://example.com/img.jpg',
      'data-float': 'left',
      'data-width': '50%',
    })
    const html = editor.getHTML()
    expect(html).toContain('data-float="left"')
    expect(html).toContain('data-width="50%"')
    expect(html).toContain('float-left')
  })

  it('round-trips data-caption attribute', () => {
    editor.commands.setResizableImage({
      src: 'https://example.com/img.jpg',
      'data-caption': 'A beautiful photo',
    })
    const html = editor.getHTML()
    expect(html).toContain('<figcaption')
    expect(html).toContain('A beautiful photo')
  })

  it('round-trips data-link-href attribute as an anchor', () => {
    editor.commands.setResizableImage({
      src: 'https://example.com/img.jpg',
      'data-link-href': 'https://example.com',
    })
    const html = editor.getHTML()
    expect(html).toContain('<a ')
    expect(html).toContain('href="https://example.com"')
  })

  it('omits figcaption when caption is null', () => {
    editor.commands.setResizableImage({
      src: 'https://example.com/img.jpg',
      'data-caption': null,
    })
    const html = editor.getHTML()
    expect(html).not.toContain('<figcaption')
  })

  it('omits anchor when link-href is null', () => {
    editor.commands.setResizableImage({
      src: 'https://example.com/img.jpg',
      'data-link-href': null,
    })
    const html = editor.getHTML()
    expect(html).not.toContain('<a ')
  })

  it('defaults to float-none and 100% width when not specified', () => {
    editor.commands.setResizableImage({ src: 'https://example.com/img.jpg' })
    const html = editor.getHTML()
    expect(html).toContain('data-float="none"')
    expect(html).toContain('data-width="100%"')
  })

  it('parses an existing <figure data-tiptap-image> from HTML', () => {
    const figureHtml = `
      <figure data-tiptap-image data-float="right" data-width="60%">
        <img src="https://example.com/from-html.jpg" alt="from html" />
        <figcaption>Caption from HTML</figcaption>
      </figure>
    `
    editor.commands.setContent(figureHtml)
    const html = editor.getHTML()
    expect(html).toContain('data-float="right"')
    expect(html).toContain('data-width="60%"')
    expect(html).toContain('Caption from HTML')
  })

  it('falls back to parsing a plain <img> tag from legacy content', () => {
    editor.commands.setContent('<img src="https://example.com/legacy.jpg" alt="legacy" />')
    const html = editor.getHTML()
    expect(html).toContain('https://example.com/legacy.jpg')
  })

  it('can update float via updateAttributes', () => {
    editor.commands.setResizableImage({ src: 'https://example.com/img.jpg', 'data-float': 'left' })
    // Select the image node and update its float attribute
    editor.commands.selectAll()
    editor.commands.updateAttributes('resizableImage', { 'data-float': 'right' })
    const html = editor.getHTML()
    expect(html).toContain('data-float="right"')
    expect(html).not.toContain('data-float="left"')
  })
})
