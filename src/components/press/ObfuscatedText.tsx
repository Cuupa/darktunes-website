'use client'

/**
 * ObfuscatedText — renders sensitive contact data (email, phone) onto an
 * HTML5 canvas so the text is never exposed in the DOM and cannot be
 * harvested by simple scraper bots.
 *
 * Accessible: the wrapper <span> carries an aria-label with the plain value
 * so screen readers can still announce it.
 */

import { useEffect, useRef } from 'react'

interface ObfuscatedTextProps {
  /** The sensitive value to render (e.g. 'info@darktunes.com'). */
  value: string
  /** Accessible label (defaults to value). */
  ariaLabel?: string
  /** Font size in px (default 14). */
  fontSize?: number
  /** CSS colour string for the text (default 'currentColor' resolves at runtime). */
  color?: string
  className?: string
}

export function ObfuscatedText({
  value,
  ariaLabel,
  fontSize = 14,
  color,
  className,
}: ObfuscatedTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const font = `${fontSize}px ui-monospace, 'Courier New', monospace`
    ctx.font = font

    const metrics = ctx.measureText(value)
    const width = Math.ceil(metrics.width) + 4
    const height = fontSize + 8

    canvas.width = width
    canvas.height = height

    // Resolve 'currentColor' by reading the computed colour of the element.
    const resolvedColor =
      color ??
      getComputedStyle(canvas).color ??
      '#ffffff'

    ctx.font = font
    ctx.fillStyle = resolvedColor
    ctx.textBaseline = 'middle'
    ctx.fillText(value, 2, height / 2)
  }, [value, fontSize, color])

  return (
    <span
      aria-label={ariaLabel ?? value}
      title={ariaLabel ?? value}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center' }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: 'block', maxWidth: '100%' }}
      />
    </span>
  )
}
