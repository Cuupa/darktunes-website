'use client'

/**
 * src/components/epk-builder/EpkTextEditor.tsx
 *
 * HTML textarea overlay for inline text editing on the Konva canvas.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { EpkElement } from '@/lib/epk/schema/documentV2'
import { formatKonvaFontFamily } from '@/lib/epk/konvaFontFamily'

interface EpkTextEditorProps {
  element: EpkElement
  zoom: number
  onChange: (content: string) => void
  onClose: () => void
}

export function EpkTextEditor({ element, zoom, onChange, onClose }: EpkTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(element.content ?? '')
  const valueRef = useRef(value)

  useEffect(() => {
    const next = element.content ?? ''
    setValue(next)
    valueRef.current = next
  }, [element.id, element.content])

  useEffect(() => {
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [element.id])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onChange(valueRef.current)
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onChange, onClose])

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    return () => {
      onChangeRef.current(valueRef.current)
    }
  }, [])

  const commit = () => {
    onChange(valueRef.current)
    onClose()
  }

  const style: CSSProperties = {
    position: 'absolute',
    left: element.x * zoom,
    top: element.y * zoom,
    width: element.width * zoom,
    minHeight: element.height * zoom,
    fontSize: (element.style.fontSize ?? 14) * zoom,
    fontFamily: formatKonvaFontFamily(element.style.fontFamily),
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
      value={value}
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        valueRef.current = e.target.value
        setValue(e.target.value)
        onChange(e.target.value)
      }}
      onBlur={() => commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commit()
        }
      }}
    />
  )
}