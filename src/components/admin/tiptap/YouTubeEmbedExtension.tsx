'use client'

/**
 * YouTubeEmbedExtension — Tiptap node for embedded YouTube videos.
 *
 * Stores the video ID as an attribute and renders a responsive <iframe>.
 * The serialised HTML uses a <div data-youtube-embed> wrapper so the public
 * news page can style/render it without the editor-specific NodeView.
 */

import React from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the YouTube video ID from any common YouTube URL format:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://www.youtube-nocookie.com/embed/VIDEO_ID
 *   https://www.youtube.com/shorts/VIDEO_ID
 *   https://www.youtube.com/v/VIDEO_ID
 */
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim()
  const isVideoId = (value: string): boolean => /^[A-Za-z0-9_-]{11}$/.test(value)

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase()

    // youtu.be/<id>
    if (hostname === 'youtu.be') {
      const shortId = parsed.pathname.slice(1).split('/')[0]
      return isVideoId(shortId) ? shortId : null
    }

    // youtube.com/watch?v=<id> and variants
    if (hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtube-nocookie.com') {
      const v = parsed.searchParams.get('v')
      if (v && isVideoId(v)) return v

      // youtube.com/embed/<id>, /shorts/<id>, /v/<id>
      const pathMatch = parsed.pathname.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/)
      if (pathMatch) return pathMatch[1]
    }
  } catch {
    // fall through
  }

  // bare ID (11-char alphanumeric)
  if (isVideoId(trimmed)) return trimmed
  return null
}

// ─── NodeView ────────────────────────────────────────────────────────────────

function YouTubeEmbedView({ node, selected }: NodeViewProps) {
  const videoId = node.attrs['data-video-id'] as string | null
  if (!videoId) return null

  return (
    <NodeViewWrapper
      as="div"
      className={`tiptap-youtube-embed${selected ? ' tiptap-image-selected' : ''}`}
      data-drag-handle
    >
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 0,
          }}
        />
      </div>
    </NodeViewWrapper>
  )
}

// ─── Extension ───────────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtubeEmbed: {
      setYouTubeEmbed: (videoId: string) => ReturnType
    }
  }
}

export const YouTubeEmbedExtension = Node.create({
  name: 'youtubeEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      'data-video-id': { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-embed]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          const el = node as HTMLElement
          const attributeId = el.getAttribute('data-video-id')
          if (attributeId && extractYouTubeId(attributeId)) {
            return { 'data-video-id': attributeId }
          }

          const iframeSrc = el.querySelector('iframe')?.getAttribute('src')
          const fallbackId = iframeSrc ? extractYouTubeId(iframeSrc) : null
          if (fallbackId) return { 'data-video-id': fallbackId }

          return false
        },
      },
      {
        tag: 'iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"], iframe[src*="youtu.be"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false
          const el = node as HTMLElement
          const src = el.getAttribute('src')
          const videoId = src ? extractYouTubeId(src) : null
          if (!videoId) return false
          return { 'data-video-id': videoId }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const videoId = HTMLAttributes['data-video-id'] as string | null
    const iframeAttrs = mergeAttributes({
      src: `https://www.youtube-nocookie.com/embed/${videoId}`,
      title: 'YouTube video',
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowfullscreen: '',
      style: 'position:absolute;top:0;left:0;width:100%;height:100%;border:0',
    })

    return [
      'div',
      { 'data-youtube-embed': '', 'data-video-id': videoId ?? '', class: 'tiptap-youtube-embed' },
      [
        'div',
        { style: 'position:relative;width:100%;padding-bottom:56.25%' },
        ['iframe', iframeAttrs],
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(YouTubeEmbedView)
  },

  addCommands() {
    return {
      setYouTubeEmbed:
        (videoId) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { 'data-video-id': videoId } }),
    }
  },
})
