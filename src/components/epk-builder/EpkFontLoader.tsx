'use client'

/**
 * src/components/epk-builder/EpkFontLoader.tsx
 *
 * Injects @font-face rules for custom EPK document fonts (canvas preview).
 */

import { useEffect } from 'react'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'

const STYLE_ID = 'epk-custom-font-faces'

export function EpkFontLoader() {
  const fonts = useEpkEditorStore((s) => s.document.fonts)

  useEffect(() => {
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = STYLE_ID
      document.head.appendChild(styleEl)
    }

    const css = fonts
      .filter((font) => font.src)
      .map(
        (font) =>
          `@font-face{font-family:'${font.family.replace(/'/g, "\\'")}';src:url('${font.src}');font-display:swap;}`,
      )
      .join('')

    styleEl.textContent = css
  }, [fonts])

  useEffect(() => () => {
    document.getElementById(STYLE_ID)?.remove()
  }, [])

  return null
}