'use client'

/**
 * src/components/epk-builder/EpkFontFaces.tsx
 *
 * Standalone @font-face injector for read-only EPK viewers (no editor store).
 */

import { useEffect } from 'react'
import type { EpkFont } from '@/lib/epk/schema/documentV2'

interface EpkFontFacesProps {
  fonts: EpkFont[]
  styleId?: string
}

export function EpkFontFaces({ fonts, styleId = 'epk-custom-font-faces' }: EpkFontFacesProps) {
  useEffect(() => {
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
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
  }, [fonts, styleId])

  useEffect(
    () => () => {
      document.getElementById(styleId)?.remove()
    },
    [styleId],
  )

  return null
}