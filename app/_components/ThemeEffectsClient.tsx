'use client'

/**
 * app/_components/ThemeEffectsClient.tsx
 *
 * Tiny client component that applies `data-fx-*` attributes to the `<html>`
 * element based on the active ThemeEffects configuration.
 *
 * Why client-side only?
 *  CSS-class-based effects (hover zoom, tilt, glow, etc.) require a DOM
 *  attribute to be toggled on the root element so globals.css selectors like
 *  `html[data-fx-hover-zoom] img:hover` fire conditionally.  The server cannot
 *  set these attributes without FOUC risk from hydration mismatches, so we
 *  apply them in a useEffect that runs immediately after hydration.
 *
 * Because all visual changes are via pre-defined CSS classes, there is no
 *  dynamic style injection on the client path.
 *
 * Performance: when an effect is disabled its data attribute is removed, which
 * means the corresponding CSS selector never matches — zero runtime cost.
 */

import { useEffect } from 'react'
import type { ThemeEffects } from '@/config/themeConfig'

export interface ThemeEffectsClientProps {
  effects?: ThemeEffects
}

/** Map of effect keys to the `data-fx-*` attribute name applied to <html>. */
const DATA_FX_MAP = {
  crtEnabled:       'data-fx-crt',
  imageHoverZoom:   'data-fx-hover-zoom',
  imageHoverTilt:   'data-fx-hover-tilt',
  imageHoverGlow:   'data-fx-hover-glow',
  cardHoverScale:   'data-fx-card-scale',
  cardHoverLift:    'data-fx-card-lift',
  headingGlow:      'data-fx-heading-glow',
  textShimmer:      'data-fx-text-shimmer',
  borderPulse:      'data-fx-border-pulse',
  buttonRipple:     'data-fx-btn-ripple',
  scrollReveal:     'data-fx-scroll-reveal',
  chromaticAberration: 'data-fx-chromatic',
  colorWash:        'data-fx-color-wash',
} as const

export function ThemeEffectsClient({ effects }: ThemeEffectsClientProps) {
  useEffect(() => {
    const root = document.documentElement
    if (!effects) {
      // Remove all data-fx attributes
      Object.values(DATA_FX_MAP).forEach((attr) => root.removeAttribute(attr))
      return
    }

    const { overlay, hover, text, ui } = effects

    // ── Overlay ──────────────────────────────────────────────────────────────
    setAttr(root, DATA_FX_MAP.crtEnabled, overlay?.crtEnabled === true)
    setAttr(root, DATA_FX_MAP.chromaticAberration, overlay?.chromaticAberration?.enabled === true)
    setAttr(root, DATA_FX_MAP.colorWash, overlay?.colorWash?.enabled === true)

    // ── Hover/Image ──────────────────────────────────────────────────────────
    setAttr(root, DATA_FX_MAP.imageHoverZoom, hover?.imageHoverZoom?.enabled === true)
    setAttr(root, DATA_FX_MAP.imageHoverTilt, hover?.imageHoverTilt?.enabled === true)
    setAttr(root, DATA_FX_MAP.imageHoverGlow, hover?.imageHoverGlow?.enabled === true)
    setAttr(root, DATA_FX_MAP.cardHoverScale, hover?.cardHoverScale?.enabled === true)
    setAttr(root, DATA_FX_MAP.cardHoverLift, hover?.cardHoverLift?.enabled === true)

    // ── Text ─────────────────────────────────────────────────────────────────
    setAttr(root, DATA_FX_MAP.headingGlow, text?.headingGlow?.enabled === true)
    setAttr(root, DATA_FX_MAP.textShimmer, text?.textShimmer?.enabled === true)

    // ── UI ───────────────────────────────────────────────────────────────────
    setAttr(root, DATA_FX_MAP.borderPulse, ui?.borderPulse?.enabled === true)
    setAttr(root, DATA_FX_MAP.buttonRipple, ui?.buttonRipple?.enabled === true)
    setAttr(root, DATA_FX_MAP.scrollReveal, ui?.scrollReveal?.enabled === true)
  }, [effects])

  return null
}

function setAttr(el: HTMLElement, attr: string, enabled: boolean) {
  if (enabled) {
    el.setAttribute(attr, '')
  } else {
    el.removeAttribute(attr)
  }
}
