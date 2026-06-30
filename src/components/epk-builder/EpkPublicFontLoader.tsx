'use client'

/**
 * Injects Google Fonts + custom @font-face rules for read-only EPK viewers.
 */

import { useEffect, useMemo } from 'react'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { collectGoogleFontFamilies } from '@/lib/epk/collectGoogleFontFamilies'
import { buildGoogleFontsCssUrl } from '@/lib/epk/googleFonts'
import { formatKonvaFontFamily } from '@/lib/epk/konvaFontFamily'
import { EPK_FONTS_LOADED_EVENT } from './EpkFontLoader'

const CUSTOM_STYLE_ID = 'epk-public-custom-font-faces'
const GOOGLE_LINK_ID = 'epk-public-google-fonts'

interface EpkPublicFontLoaderProps {
  epkDocument: EpkDocumentV2
}

export function EpkPublicFontLoader({ epkDocument }: EpkPublicFontLoaderProps) {
  const googleFamilies = useMemo(() => collectGoogleFontFamilies(epkDocument), [epkDocument])

  useEffect(() => {
    const href = buildGoogleFontsCssUrl(googleFamilies)
    let link = globalThis.document.getElementById(GOOGLE_LINK_ID) as HTMLLinkElement | null
    if (!href) {
      link?.remove()
      return
    }
    if (!link) {
      link = globalThis.document.createElement('link')
      link.id = GOOGLE_LINK_ID
      link.rel = 'stylesheet'
      globalThis.document.head.appendChild(link)
    }
    link.href = href

    let cancelled = false
    link.onload = () => {
      if (!cancelled) window.dispatchEvent(new CustomEvent(EPK_FONTS_LOADED_EVENT))
    }
    return () => {
      cancelled = true
    }
  }, [googleFamilies])

  useEffect(() => {
    const families = collectGoogleFontFamilies(epkDocument)
    if (families.length === 0) return

    let cancelled = false
    void Promise.all(
      families.map((family) =>
        globalThis.document.fonts.load(`16px ${formatKonvaFontFamily(family)}`).catch(() => undefined),
      ),
    ).then(() => {
      if (!cancelled) window.dispatchEvent(new CustomEvent(EPK_FONTS_LOADED_EVENT))
    })

    return () => {
      cancelled = true
    }
  }, [epkDocument])

  useEffect(() => {
    let styleEl = globalThis.document.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = globalThis.document.createElement('style')
      styleEl.id = CUSTOM_STYLE_ID
      globalThis.document.head.appendChild(styleEl)
    }

    const css = epkDocument.fonts
      .filter((font) => font.src)
      .map(
        (font) =>
          `@font-face{font-family:'${font.family.replace(/'/g, "\\'")}';src:url('${font.src}');font-display:swap;}`,
      )
      .join('')

    styleEl.textContent = css
    window.dispatchEvent(new CustomEvent(EPK_FONTS_LOADED_EVENT))
  }, [epkDocument.fonts])

  useEffect(
    () => () => {
      globalThis.document.getElementById(GOOGLE_LINK_ID)?.remove()
      globalThis.document.getElementById(CUSTOM_STYLE_ID)?.remove()
    },
    [],
  )

  return null
}