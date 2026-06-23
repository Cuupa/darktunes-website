'use client'

/**
 * src/components/epk-builder/EpkTextEditor.tsx
 *
 * HTML textarea overlay for inline text editing on the Konva canvas.
 */

import { useEffect, useRef, type CSSProperties } from 'react'
import type { EpkElement } from '@/lib/epk/schema/documentV2'

interface EpkTextEditorProps {
  element: EpkElement
  zoom: number
  onChange: (content: string) => void
  onClose: () => void
}

export function EpkTextEditor({ element, zoom, onChange, onClose }: EpkTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [element.id])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const style: CSSProperties = {
    position: 'absolute',
    left: element.x * zoom,
    top: element.y * zoom,
    width: element.width * zoom,
    minHeight: element.height * zoom,
    fontSize: (element.style.fontSize ?? 14) * zoom,
    fontFamily: element.style.fontFamily ?? 'Helvetica, Arial, sans-serif',
    color: element.style.fill ?? '#ffffff',
    textAlign: element.style.textAlign ?? 'left',
    lineHeight: element.style.lineHeight ?? 1.4,
    background: 'rgba(16, 16, 16, 0.92)',
    border: '2px solid #493687',
    borderRadius: 4,
    padding: 4,
    resize: 'none',
    outline: 'none',
    zIndex: 20,
  }

  return (
    <textarea
      ref={textareaRef}
      aria-label="Edit text element"
      defaultValue={element.content ?? ''}
      style={style}
      onBlur={(e) => {
        onChange(e.target.value)
        onClose()
      }}
    />
  )
}