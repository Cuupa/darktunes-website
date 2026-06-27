import type { PDFFont } from 'pdf-lib'

export type TextAlign = 'left' | 'center' | 'right'

export interface WrappedTextLine {
  text: string
  x: number
  y: number
  align: TextAlign
}

export function normalizeFontFamily(family?: string): string {
  if (!family?.trim()) return 'Helvetica, Arial, sans-serif'
  const trimmed = family.trim()
  if (trimmed === 'Helvetica') return 'Helvetica, Arial, sans-serif'
  return trimmed
}

export function wrapTextToLines(
  text: string,
  measureWidth: (line: string) => number,
  maxWidth: number,
): string[] {
  const output: string[] = []

  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      output.push('')
      continue
    }

    const words = paragraph.split(/\s+/).filter(Boolean)
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (measureWidth(candidate) > maxWidth && current) {
        output.push(current)
        current = word
      } else {
        current = candidate
      }
    }

    if (current) output.push(current)
  }

  return output
}

export function layoutWrappedText(options: {
  text: string
  font: PDFFont
  fontSize: number
  boxX: number
  boxY: number
  boxWidth: number
  boxHeight: number
  padding: number
  lineHeight: number
  textAlign?: TextAlign
}): WrappedTextLine[] {
  const {
    text,
    font,
    fontSize,
    boxX,
    boxY,
    boxWidth,
    boxHeight,
    padding,
    lineHeight,
    textAlign = 'left',
  } = options

  const innerWidth = Math.max(1, boxWidth - padding * 2)
  const lineAdvance = fontSize * lineHeight
  const lines = wrapTextToLines(text, (line) => font.widthOfTextAtSize(line, fontSize), innerWidth)

  const maxLines = Math.max(1, Math.floor((boxHeight - padding) / lineAdvance))
  const visibleLines = lines.slice(0, maxLines)

  return visibleLines.map((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, fontSize)
    let x = boxX + padding

    if (textAlign === 'center') {
      x = boxX + boxWidth / 2
    } else if (textAlign === 'right') {
      x = boxX + boxWidth - padding - lineWidth
    }

    return {
      text: line,
      x,
      y: boxY + boxHeight - padding - fontSize - index * lineAdvance,
      align: textAlign,
    }
  })
}

export function snapValue(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}