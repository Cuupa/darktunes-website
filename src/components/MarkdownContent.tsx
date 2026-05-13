/**
 * MarkdownContent — lightweight inline Markdown renderer.
 *
 * Supports: headings (# ## ###), bold (**), italic (*), links ([text](url)),
 * images (![alt](url)), YouTube embeds (bare YouTube URL on its own line),
 * unordered list items (- item), blockquotes (> text), and paragraphs.
 *
 * Intentionally avoids the react-markdown dependency to keep the bundle lean.
 */

import { extractYouTubeVideoId } from '@/lib/parsers/platformUrlParser'

interface MarkdownContentProps {
  content: string
  className?: string
}

interface TextPart {
  type: 'text' | 'bold' | 'italic' | 'link' | 'image'
  text?: string
  href?: string
  alt?: string
  src?: string
}

function parseInline(text: string): TextPart[] {
  const parts: TextPart[] = []
  // Combined regex: images, links, bold, italic
  const regex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    if (match[0].startsWith('![')) {
      parts.push({ type: 'image', alt: match[1], src: match[2] })
    } else if (match[0].startsWith('[')) {
      parts.push({ type: 'link', text: match[3], href: match[4] })
    } else if (match[0].startsWith('**')) {
      parts.push({ type: 'bold', text: match[5] })
    } else {
      parts.push({ type: 'italic', text: match[6] })
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) })
  }
  return parts
}

function renderInlineParts(parts: TextPart[]): React.ReactNode[] {
  return parts.map((part, i) => {
    switch (part.type) {
      case 'bold':
        return <strong key={i}>{part.text}</strong>
      case 'italic':
        return <em key={i}>{part.text}</em>
      case 'link':
        return (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {part.text}
          </a>
        )
      case 'image':
        return (
          <img
            key={i}
            src={part.src}
            alt={part.alt ?? ''}
            className="max-w-full rounded-lg my-2"
            loading="lazy"
            decoding="async"
          />
        )
      default:
        return <span key={i}>{part.text}</span>
    }
  })
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const blocks = content.split('\n\n').filter(Boolean)

  const elements = blocks.map((block, idx) => {
    const trimmed = block.trim()

    // Headings
    if (trimmed.startsWith('### ')) {
      return <h3 key={idx} className="text-2xl font-bold mt-8 mb-3 tracking-tight">{renderInlineParts(parseInline(trimmed.slice(4)))}</h3>
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={idx} className="text-3xl font-bold mt-10 mb-4 tracking-tight">{renderInlineParts(parseInline(trimmed.slice(3)))}</h2>
    }
    if (trimmed.startsWith('# ')) {
      return <h1 key={idx} className="text-4xl font-bold mt-10 mb-4 tracking-tight">{renderInlineParts(parseInline(trimmed.slice(2)))}</h1>
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      return (
        <blockquote key={idx} className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
          {renderInlineParts(parseInline(trimmed.slice(2)))}
        </blockquote>
      )
    }

    // Unordered list
    const lines = trimmed.split('\n')
    if (lines.every((l) => l.startsWith('- '))) {
      return (
        <ul key={idx} className="list-disc list-inside space-y-1 my-4 text-foreground/90 font-serif leading-relaxed">
          {lines.map((l, li) => (
            <li key={li}>{renderInlineParts(parseInline(l.slice(2)))}</li>
          ))}
        </ul>
      )
    }

    // Bare YouTube URL on its own line
    const youtubeId = extractYouTubeVideoId(trimmed)
    if (youtubeId && !/\s/.test(trimmed)) {
      return (
        <div key={idx} className="relative aspect-video my-6 rounded-xl overflow-hidden">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            loading="lazy"
          />
        </div>
      )
    }

    // Default: paragraph (multi-line blocks rendered line-by-line inside <p>)
    return (
      <p key={idx} className="text-foreground/90 leading-relaxed font-serif">
        {lines.map((line, li) => (
          <span key={li}>
            {renderInlineParts(parseInline(line))}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    )
  })

  return <div className={`space-y-4 ${className ?? ''}`}>{elements}</div>
}
