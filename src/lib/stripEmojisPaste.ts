import type { ClipboardEvent } from 'react'
import { containsEmojis, stripEmojis } from '@/lib/stripEmojis'

export function stripEmojisOnPaste(
  event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
): string | null {
  const pasted = event.clipboardData.getData('text/plain')
  if (!containsEmojis(pasted)) return null

  event.preventDefault()
  const cleaned = stripEmojis(pasted)
  const target = event.currentTarget
  const start = target.selectionStart ?? target.value.length
  const end = target.selectionEnd ?? target.value.length
  const nextValue = `${target.value.slice(0, start)}${cleaned}${target.value.slice(end)}`

  const prototype =
    target instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  valueSetter?.call(target, nextValue)
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.setSelectionRange(start + cleaned.length, start + cleaned.length)

  return nextValue
}