'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface Releases3DCarouselProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
}

/** Pixel offsets and visual properties for each card slot relative to centre */
interface CardSlotStyle {
  translateX: number
  translateZ: number
  rotateY: number
  scale: number
  opacity: number
  zIndex: number
}

/** Distance of the viewer from the Z=0 plane. Higher = more subtle 3D effect. */
const PERSPECTIVE = 1200 // px

/**
 * Returns a fluid card width in pixels: 36 vw, clamped between 260 px and 560 px.
 * Falls back to 380 on the server (component is 'use client').
 */
function computeCardWidth(): number {
  if (typeof window === 'undefined') return 380
  return Math.min(560, Math.max(260, Math.round(window.innerWidth * 0.36)))
}

/**
 * Compute display style for a card at `offset` positions from the centre.
 * Offset 0 = centre card, ±1 = adjacent, ±2 = far sides.
 *
 * Side cards are pushed back in Z AND rotated around Y so they read as
 * genuinely three-dimensional rather than just scaled-down copies.
 * The narrower horizontal spacing (55 % of card width) keeps the full
 * card face visible even after the rotateY transform.
 */
function slotStyle(offset: number, reduced: boolean, cardWidth: number): CardSlotStyle | null {
  const abs = Math.abs(offset)
  if (abs > 2) return null

  if (reduced) {
    return {
      translateX: offset * (cardWidth * 0.65),
      translateZ: 0,
      rotateY: 0,
      scale: abs === 0 ? 1 : 0.75,
      opacity: abs === 0 ? 1 : 0.55,
      zIndex: 10 - abs,
    }
  }

  // Lateral offset: spread cards so the rotated faces are still visible
  const translateX = offset * (cardWidth * 0.55)
  // Y rotation: 45 ° for first neighbours, 55 ° for outer
  const rotateY = -offset * (abs === 1 ? 45 : 55)
  // Push side cards behind the centre card along Z
  const translateZ = abs === 0 ? 60 : -abs * 140
  const scale = abs === 0 ? 1 : 1 - abs * 0.12   // 1.0 → 0.88 → 0.76
  const opacity = abs === 0 ? 1 : 1 - abs * 0.15 // 1.0 → 0.85 → 0.70
  const zIndex = 10 - abs * 2

  return { translateX, translateZ, rotateY, scale, opacity, zIndex }
}

export function Releases3DCarousel({ releases, dict, locale }: Releases3DCarouselProps) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const router = useRouter()
  const total = releases.length
  const [currentIndex, setCurrentIndex] = useState(0)

  // Fluid card width: 36 vw, clamped [280, 500] px. Updates on resize (debounced).
  const [cardWidth, setCardWidth] = useState(computeCardWidth)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setCardWidth(computeCardWidth()), 150)
    }
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', update)
    }
  }, [])

  // Stage height = square card + metadata area
  const stageHeight = cardWidth + 140

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total)
  }, [total])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total)
  }, [total])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev()
    else if (e.key === 'ArrowRight') handleNext()
  }

  if (total === 0) return null

  return (
    <div
      className="relative select-none py-4 focus:outline-none"
      role="region"
      aria-label="Releases 3D carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ------------------------------------------------------------------ */}
      {/* 3D stage — overflow-visible so rotated side cards aren't clipped    */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="relative mx-auto"
        style={{
          perspective: PERSPECTIVE,
          perspectiveOrigin: '50% 40%',
          height: stageHeight,
          maxWidth: '100%',
          /* Must NOT be overflow:hidden — that clips the 3D transforms */
          overflow: 'visible',
        }}
      >
        {releases.map((release, releaseIdx) => {
          // Compute this release's offset from centre, wrapping to [-total/2, total/2]
          let offset = releaseIdx - currentIndex
          if (offset > total / 2) offset -= total
          if (offset < -total / 2) offset += total

          const style = slotStyle(offset, prefersReducedMotion, cardWidth)
          if (!style) return null

          const isCenter = offset === 0

          return (
            <motion.div
              key={release.id}
              className="absolute top-0 cursor-pointer"
              style={{
                width: cardWidth,
                left: '50%',
                marginLeft: -(cardWidth / 2),
                transformStyle: 'preserve-3d',
              }}
              animate={{
                x: style.translateX,
                z: style.translateZ,
                rotateY: style.rotateY,
                scale: style.scale,
                opacity: style.opacity,
                zIndex: style.zIndex,
              }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: 'easeInOut' }}
              onClick={() => {
                if (isCenter) {
                  router.push(`/releases/${release.id}`)
                } else {
                  setCurrentIndex(releaseIdx)
                }
              }}
              whileHover={isCenter ? { scale: style.scale * 1.03 } : { scale: style.scale * 1.02 }}
              aria-label={
                isCenter
                  ? `View release: ${release.title}`
                  : `Show release: ${release.title}`
              }
            >
              <Card
                className={`bg-card overflow-hidden transition-colors duration-300 ${
                  isCenter
                    ? 'border-accent/60 shadow-[0_8px_40px_-8px_rgba(73,54,135,0.6)]'
                    : 'border-border hover:border-accent/30'
                }`}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={getOptimizedImageUrl(release.coverArt, 600)}
                    alt={`${release.title} – cover art`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  {/* Gradient overlay on centre card */}
                  {isCenter && (
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                  )}
                  {release.featured && (
                    <Badge className="absolute top-3 right-3 bg-secondary/90 text-secondary-foreground text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                      {dict.featured}
                    </Badge>
                  )}
                </div>

                {/* Only show text metadata on the centre card */}
                {isCenter && (
                  <div className="p-4 space-y-1.5">
                    <Badge
                      variant="outline"
                      className="uppercase text-xs font-mono tracking-widest border-primary/30 text-primary-foreground"
                    >
                      {release.type}
                    </Badge>
                    <h3 className="text-lg font-bold line-clamp-1 text-foreground">{release.title}</h3>
                    <p className="text-sm text-muted-foreground font-medium">{release.artistName}</p>
                    <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                      <Calendar size={12} weight="bold" aria-hidden="true" />
                      {new Date(release.releaseDate).toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Navigation controls                                                 */}
      {/* ------------------------------------------------------------------ */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-6 mt-6">
          <button
            onClick={handlePrev}
            aria-label="Previous release"
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>

          {/* Dot indicators (show max 12 to keep the row tidy) */}
          <div className="flex gap-1.5" role="tablist" aria-label="Release dots">
            {releases.slice(0, 12).map((r, i) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={i === currentIndex}
                aria-label={`Go to release ${i + 1}: ${r.title}`}
                onClick={() => setCurrentIndex(i)}
                className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  i === currentIndex
                    ? 'bg-accent w-6'
                    : 'bg-muted-foreground/40 hover:bg-muted-foreground/70 w-2'
                }`}
              />
            ))}
            {total > 12 && (
              <span className="text-xs text-muted-foreground font-mono self-center pl-1">
                +{total - 12}
              </span>
            )}
          </div>

          <button
            onClick={handleNext}
            aria-label="Next release"
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretRight size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground font-mono mt-2">
        {currentIndex + 1} / {total}
      </p>
    </div>
  )
}
