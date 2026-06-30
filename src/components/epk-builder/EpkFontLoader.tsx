'use client'

/**
 * src/components/epk-builder/EpkFontLoader.tsx
 *
 * Injects @font-face rules for custom EPK document fonts (canvas preview).
 */

import { useEffect, useMemo } from 'react'
import { useEpkEditorStore } from '@/lib/epk/editor/EpkEditorProvider'
import { buildGoogleFontsCssUrl, isGoogleFontFamily } from '@/lib/epk/googleFonts'
import { formatKonvaFontFamily } from '@/lib/epk/konvaFontFamily'

export const EPK_FONTS_LOADED_EVENT = 'epk-fonts-loaded'

const STYLE_ID = 'epk-custom-font-faces'
const GOOGLE_LINK_ID = 'epk-google-fonts'

export function EpkFontLoader() {
  const fonts = useEpkEditorStore((s) => s.document.fonts)
  const elements = useEpkEditorStore((s) => s.document.elements)

  const googleFamilies = useMemo(() => {
    const families = new Set<string>()
    for (const font of fonts) {
      if (isGoogleFontFamily(font.family)) families.add(font.family)
    }
    for (const el of elements) {
      const family = el.style?.fontFamily
      if (family && isGoogleFontFamily(family)) families.add(family)
    }
    return [...families]
  }, [elements, fonts])

  useEffect(() => {
    const href = buildGoogleFontsCssUrl(googleFamilies)
    let link = document.getElementById(GOOGLE_LINK_ID) as HTMLLinkElement | null
    if (!href) {
      link?.remove()
      return
    }
    if (!link) {
      link = document.createElement('link')
      link.id = GOOGLE_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = href
  }, [googleFamilies])

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

  useEffect(() => {
    const families = new Set<string>()
    for (const font of fonts) {
      if (font.family) families.add(font.family)
    }
    for (const el of elements) {
      if (el.style?.fontFamily) families.add(el.style.fontFamily.split(',')[0].trim())
    }
    if (families.size === 0) return

    let cancelled = false
    void Promise.all(
      [...families].map((family) =>
        document.fonts.load(`16px ${formatKonvaFontFamily(family)}`).catch(() => undefined),
      ),
    ).then(() => {
      if (!cancelled) window.dispatchEvent(new CustomEvent(EPK_FONTS_LOADED_EVENT))
    })
    return () => {
      cancelled = true
    }
  }, [elements, fonts, googleFamilies])

  useEffect(() => () => {
    document.getElementById(STYLE_ID)?.remove()
  }, [])

  return null
}