'use client'

/**
 * VisualEffectsOverlay
 *
 * Renders three fixed, non-interactive overlay layers on top of the page
 * background but beneath all interactive UI (z-index < 9990):
 *
 *  1. Animated noise / grain  — subtle film-grain texture
 *  2. CRT scanlines            — horizontal line pattern (optional)
 *  3. Vignette                 — radial darkening at screen edges
 *
 * This is a "dumb" Client Component: it receives all configuration as props
 * from the Server Component parent (app/layout.tsx) and does not fetch or
 * read any global state directly (IoC principle).
 *
 * All overlays use pointer-events: none so they never block user interactions.
 */

interface VisualEffectsOverlayProps {
  /** Opacity of the animated noise/grain layer (0–1). */
  noiseOpacity: number
  /** Whether the CRT scanline overlay is rendered. */
  crtScanlinesEnabled: boolean
  /** Opacity of the vignette radial gradient (0–1). */
  vignetteIntensity: number
}

const OVERLAY_BASE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
  transform: 'translateZ(0)',
  contain: 'strict',
}

export function VisualEffectsOverlay({
  noiseOpacity,
  crtScanlinesEnabled,
  vignetteIntensity,
}: VisualEffectsOverlayProps) {
  return (
    <>
      {/* ── Vignette (anti-banding) ────────────────────────────────────────── */}
      {/* isolation: isolate (via .vignette-dithered) confines the ::after    */}
      {/* noise's soft-light blend to the gradient only, preventing it from   */}
      {/* interacting with page content. The noise breaks up gradient banding. */}
      <div
        aria-hidden="true"
        className="vignette-dithered"
        style={{
          ...OVERLAY_BASE,
          zIndex: 'var(--z-global-fx)',
          background: `radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,${vignetteIntensity * 0.65}) 100%)`,
          boxShadow: `inset 0 0 160px rgba(0,0,0,${vignetteIntensity})`,
        }}
      />

      {/* ── CRT Scanlines ─────────────────────────────────────────────────── */}
      {crtScanlinesEnabled && (
        <div
          aria-hidden="true"
          className="scanlines-overlay"
          style={{
            ...OVERLAY_BASE,
            zIndex: 'calc(var(--z-global-fx) + 1)',
            background:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12) 1px, transparent 1px, transparent 2px)',
            backgroundSize: '100% 2px',
          }}
        />
      )}

      {/* ── Animated Noise / Grain ─────────────────────────────────────────── */}
      {/* 600 × 600 SVG canvas with baseFrequency 0.65 and 4 octaves produces  */}
      {/* finer, more varied film-grain without obvious tiling seams.           */}
      <div
        aria-hidden="true"
        className="noise-overlay"
        style={{
          ...OVERLAY_BASE,
          zIndex: 'calc(var(--z-global-fx) + 2)',
          opacity: noiseOpacity,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '300px 300px',
        }}
      />
    </>
  )
}
