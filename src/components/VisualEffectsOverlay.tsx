'use client'

/**
 * VisualEffectsOverlay
 *
 * Renders all visual effects (vignette, CRT scanlines, film grain/noise) as a
 * **single** `position: fixed` element to minimise GPU compositor layers.
 *
 * Layer strategy:
 *  - Parent div  — vignette via `background` + `box-shadow: inset`
 *  - `::before`  — animated CRT scanlines (CSS class `vfx-scanlines` toggled)
 *  - `::after`   — film-grain noise (opacity controlled via CSS custom property)
 *
 * Dynamic CMS values are passed as CSS custom properties:
 *  --vfx-noise-opacity   : controls noise ::after opacity
 *  --vfx-vignette-shadow : full rgba value for box-shadow inset
 *  --vfx-vignette-grad   : reduced rgba value for radial-gradient background
 *
 * All overlays use pointer-events: none — they never block user interactions.
 * The CSS for ::before/::after lives in globals.css (.vfx-overlay).
 */

interface VisualEffectsOverlayProps {
  /** Opacity of the animated noise/grain layer (0–1). */
  noiseOpacity: number
  /** Whether the CRT scanline overlay is rendered. */
  crtScanlinesEnabled: boolean
  /** Opacity of the vignette radial gradient (0–1). */
  vignetteIntensity: number
}

export function VisualEffectsOverlay({
  noiseOpacity,
  crtScanlinesEnabled,
  vignetteIntensity,
}: VisualEffectsOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className={`vfx-overlay${crtScanlinesEnabled ? ' vfx-scanlines' : ''}`}
      style={
        {
          '--vfx-noise-opacity': noiseOpacity,
          '--vfx-vignette-shadow': `rgba(0,0,0,${vignetteIntensity})`,
          '--vfx-vignette-grad': `rgba(0,0,0,${(vignetteIntensity * 0.65).toFixed(3)})`,
        } as React.CSSProperties
      }
    />
  )
}
