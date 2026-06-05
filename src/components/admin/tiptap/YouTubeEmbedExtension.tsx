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
 */
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    // youtu.be/<id>
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0] || null
    }
    // youtube.com/watch?v=<id>
    const v = parsed.searchParams.get('v')
    if (v) return v
    // youtube.com/embed/<id>
    const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/)
    if (embedMatch) return embedMatch[1]
  } catch {
    // fall through
  }
  // bare ID (11-char alphanumeric)
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed
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
          return { 'data-video-id': el.getAttribute('data-video-id') ?? null }
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
