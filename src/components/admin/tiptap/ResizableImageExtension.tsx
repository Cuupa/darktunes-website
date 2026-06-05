'use client'

/**
 * ResizableImageExtension — custom Tiptap Node extending the built-in Image.
 *
 * Adds four extra attributes:
 *   data-float:      "left" | "right" | "center" | "none"
 *   data-width:      CSS string, e.g. "50%" or "300px"
 *   data-caption:    string | null
 *   data-link-href:  string | null
 *
 * The NodeView renders a <figure> wrapper so that float/caption/link work
 * in both the editor and in the saved HTML that is displayed on the public
 * news page.
 */

import React from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

// ─── Attribute types ────────────────────────────────────────────────────────

export type ImageFloat = 'left' | 'right' | 'center' | 'none'

export interface ResizableImageAttrs {
  src: string
  alt?: string | null
  title?: string | null
  'data-float'?: ImageFloat
  'data-width'?: string
  'data-caption'?: string | null
  'data-link-href'?: string | null
}

// ─── NodeView component ──────────────────────────────────────────────────────

function ResizableImageView({ node, selected }: NodeViewProps) {
  const { src, alt, title } = node.attrs as ResizableImageAttrs
  const float = (node.attrs['data-float'] as ImageFloat | undefined) ?? 'none'
  const width = (node.attrs['data-width'] as string | undefined) ?? '100%'
  const caption = node.attrs['data-caption'] as string | null | undefined
  const linkHref = node.attrs['data-link-href'] as string | null | undefined

  const imgEl = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ''}
      title={title ?? undefined}
      style={{ width, display: 'block', maxWidth: '100%' }}
      draggable={false}
    />
  )

  return (
    <NodeViewWrapper
      as="figure"
      className={`tiptap-image-figure float-${float}${selected ? ' tiptap-image-selected' : ''}`}
      data-drag-handle
    >
      {linkHref ? (
        <a href={linkHref} target="_blank" rel="noopener noreferrer">
          {imgEl}
        </a>
      ) : (
        imgEl
      )}
      {caption ? (
        <figcaption>{caption}</figcaption>
      ) : null}
    </NodeViewWrapper>
  )
}

// ─── Extension ──────────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (attrs: ResizableImageAttrs) => ReturnType
    }
  }
}

export const ResizableImageExtension = Node.create({
  name: 'resizableImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      'data-float': { default: 'none' },
      'data-width': { default: '100%' },
      'data-caption': { default: null },
      'data-link-href': { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-tiptap-image]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          const el = node as HTMLElement
          const img = el.querySelector('img')
          const caption = el.querySelector('figcaption')
          const link = el.querySelector('a')
          return {
            src: img?.getAttribute('src') ?? null,
            alt: img?.getAttribute('alt') ?? null,
            title: img?.getAttribute('title') ?? null,
            'data-float': (el.getAttribute('data-float') as ImageFloat | null) ?? 'none',
            'data-width': el.getAttribute('data-width') ?? '100%',
            'data-caption': caption?.textContent ?? null,
            'data-link-href': link?.getAttribute('href') ?? null,
          }
        },
      },
      // Legacy fallback: plain <img> tags from older content
      {
        tag: 'img[src]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          const el = node as HTMLImageElement
          return {
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt'),
            title: el.getAttribute('title'),
            'data-float': 'none',
            'data-width': el.style.width || '100%',
            'data-caption': null,
            'data-link-href': null,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const {
      src,
      alt,
      title,
      'data-float': float,
      'data-width': width,
      'data-caption': caption,
      'data-link-href': linkHref,
    } = HTMLAttributes as ResizableImageAttrs & { [key: string]: unknown }

    const imgAttrs = mergeAttributes(
      { src, alt, title, style: `width:${width ?? '100%'};display:block;max-width:100%` },
    )

    const imgNode: [string, ...unknown[]] = ['img', imgAttrs]
    const innerContent: unknown[] = linkHref
      ? [['a', { href: linkHref, target: '_blank', rel: 'noopener noreferrer' }, imgNode]]
      : [imgNode]

    if (caption) {
      innerContent.push(['figcaption', {}, caption])
    }

    return [
      'figure',
      {
        'data-tiptap-image': '',
        'data-float': float ?? 'none',
        'data-width': width ?? '100%',
        class: `tiptap-image-figure float-${float ?? 'none'}`,
      },
      ...innerContent,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },

  addCommands() {
    return {
      setResizableImage:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          })
        },
    }
  },
})
