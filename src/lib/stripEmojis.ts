/**
 * Removes emoji characters from user-facing text for accessibility.
 * Preserves all other Unicode (umlauts, symbols, punctuation, etc.).
 */

/** Matches emoji sequences including skin tones, ZWJ families, and flags. */
const EMOJI_PATTERN =
  /(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|\p{Regional_Indicator}{2})/gu

export function containsEmojis(text: string): boolean {
  if (!text) return false
  EMOJI_PATTERN.lastIndex = 0
  return EMOJI_PATTERN.test(text)
}

export function stripEmojis(text: string): string {
  if (!text) return ''
  EMOJI_PATTERN.lastIndex = 0
  return text.replace(EMOJI_PATTERN, '')
}

/**
 * Strips emojis from HTML while preserving tags and attributes.
 * Falls back to plain strip when not in a browser (SSR).
 */
export function stripEmojisFromHtml(html: string): string {
  if (!html) return ''

  if (typeof document === 'undefined') {
    return stripEmojis(html)
  }

  const template = document.createElement('template')
  template.innerHTML = html

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const textNode = node as Text
    const cleaned = stripEmojis(textNode.data)
    if (cleaned !== textNode.data) {
      textNode.data = cleaned
    }
    node = walker.nextNode()
  }

  return template.innerHTML
}