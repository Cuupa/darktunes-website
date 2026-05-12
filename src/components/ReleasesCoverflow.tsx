'use client'

import { useEffect, useCallback, useState } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { EmblaCarouselType } from 'embla-carousel'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Calendar, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

export interface ReleasesCoverflowProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
}

/**
 * Directly mutates CSS transforms on each slide's inner element to produce
 * the 3D coverflow effect.  This function is called from Embla's `scroll`
 * event — it NEVER touches React state, so there are zero component
 * re-renders on scroll.  All visual work is done by the GPU compositor via
 * `transform` and `opacity` (hardware-accelerated properties only).
 */
function tweenSlides(api: EmblaCarouselType, prefersReducedMotion: boolean): void {
  const engine = api.internalEngine()
  const scrollProgress = api.scrollProgress()
  const slideNodes = api.slideNodes()
  const snapList = api.scrollSnapList()
  const snapCount = snapList.length

  snapList.forEach((scrollSnap, snapIndex) => {
    let diffToTarget = scrollSnap - scrollProgress

    // Official Embla loop-point correction: adjust diffToTarget when the
    // carousel wraps around so that boundary slides animate correctly.
    if (engine.options.loop) {
      engine.slideLooper.loopPoints.forEach((loopItem) => {
        const target = loopItem.target()
        if (snapIndex === loopItem.index && target !== 0) {
          const sign = Math.sign(target)
          if (sign === -1) diffToTarget = scrollSnap - (1 + scrollProgress)
          if (sign === 1) diffToTarget = scrollSnap + (1 - scrollProgress)
        }
      })
    }

    const inner = slideNodes[snapIndex]?.firstElementChild as HTMLElement | null
    if (!inner) return

    if (prefersReducedMotion) {
      // Reduced motion: no rotation or depth, just a slight opacity fade
      inner.style.transform = ''
      inner.style.opacity = Math.abs(diffToTarget) < 0.15 ? '1' : '0.55'
      return
    }

    // Convert the normalised scroll diff → "slide units"
    // (1 unit = one snap interval — gives clean integer values at rest)
    const distInSlides = diffToTarget * Math.max(1, snapCount - 1)
    const abs = Math.abs(distInSlides)

    // 3D coverflow interpolation — GPU-only properties (transform + opacity)
    const rotateY = -distInSlides * 44                    // deg: fan inward
    const translateZ = abs > 0 ? -(abs * 80) : 0         // px: push back in Z
    const scale = Math.max(0.4, 1 - abs * 0.28)          // 1.0 → 0.72 → 0.44
    const opacity = abs > 2.5 ? 0 : Math.max(0.2, 1 - abs * 0.35)

    inner.style.transform = `rotateY(${rotateY}deg) scale(${scale}) translate3d(0, 0, ${translateZ}px)`
    inner.style.opacity = String(Math.max(0, opacity))
  })
}

/**
 * ReleasesCoverflow — a hardware-accelerated 3D Embla coverflow gallery.
 *
 * Performance design:
 * - Embla is the scroll engine (~5 KB, physics-based, zero injected CSS).
 * - Scroll-driven transforms are applied via direct DOM mutation in the
 *   `on('scroll')` callback — never via React state, never causing re-renders.
 * - Only `selectedIndex` (for the metadata panel and dot nav) lives in state;
 *   it is updated lazily via `on('select')`.
 *
 * 3D CSS architecture (avoids the preserve-3d / overflow-hidden flattening trap):
 * - `perspective` lives on an outer wrapper div — NOT on the overflow-hidden
 *   Embla viewport.  This keeps the 3D context intact.
 * - `overflow-hidden` is on the Embla viewport (clips card edges only).
 * - `transform-style: preserve-3d` is on each slide's inner content wrapper.
 */
export function ReleasesCoverflow({ releases, dict, locale }: ReleasesCoverflowProps) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const total = releases.length

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: total > 2,
    align: 'center',
    dragFree: false,
  })

  // React state only for the selected index — drives the metadata panel and
  // dot indicators.  Scroll progress itself never enters React state.
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onTween = useCallback(() => {
    if (emblaApi) tweenSlides(emblaApi, prefersReducedMotion)
  }, [emblaApi, prefersReducedMotion])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setSelectedIndex(emblaApi.selectedScrollSnap())
    tweenSlides(emblaApi, prefersReducedMotion)
  }, [emblaApi, prefersReducedMotion])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('scroll', onTween)
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    // Apply initial transforms on mount
    onSelect()
    return () => {
      emblaApi.off('scroll', onTween)
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onTween, onSelect])

  const handlePrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const handleNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev()
      else if (e.key === 'ArrowRight') handleNext()
    },
    [handlePrev, handleNext],
  )

  if (total === 0) return null

  const activeRelease = releases[selectedIndex]

  return (
    <div
      className="relative select-none focus:outline-none py-4"
      role="region"
      aria-label="Releases coverflow"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* ── 3D Stage ───────────────────────────────────────────────────────── */}
      {/*
        `perspective` lives here — on the outer wrapper — NOT on the
        overflow-hidden Embla viewport.  Placing both `overflow: hidden` and
        `transform-style: preserve-3d` on the same element would flatten the
        3D context per the CSS spec.  Keeping them on separate elements avoids
        this trap while still clipping the carousel edges correctly.
      */}
      <div style={{ perspective: '1000px' }}>
        {/* Embla viewport: overflow-hidden clips side-card overflow */}
        <div ref={emblaRef} className="overflow-hidden">
          {/* Embla container: Embla translates this element for scrolling */}
          <div className="flex">
            {releases.map((release) => (
              <div
                key={release.id}
                // Fluid viewport-relative widths — no hardcoded pixel values.
                // Mobile-first: 70 vw → tablet 50 vw → desktop 35 vw / 2xl cap.
                className="flex-none w-[70vw] md:w-[50vw] lg:w-[35vw] max-w-2xl px-2"
              >
                {/*
                  Inner wrapper: this element receives all 3D transforms
                  (rotateY, scale, translate3d) via direct DOM mutation inside
                  tweenSlides().  It is never re-rendered on scroll — the GPU
                  compositor handles every frame at 60 fps.
                */}
                <div
                  style={{
                    transformStyle: 'preserve-3d',
                    willChange: 'transform, opacity',
                  }}
                >
                  <Link
                    href={`/releases/${release.id}`}
                    aria-label={`${release.title} by ${release.artistName} – cover art`}
                    draggable={false}
                    tabIndex={release.id === activeRelease?.id ? 0 : -1}
                  >
                    <div
                      className={`relative aspect-square overflow-hidden rounded-lg border transition-colors duration-300 ${
                        release.id === activeRelease?.id
                          ? 'border-accent/60 shadow-[0_8px_40px_-8px_rgba(73,54,135,0.6)]'
                          : 'border-border hover:border-accent/30'
                      }`}
                    >
                      <img
                        src={getOptimizedImageUrl(release.coverArt, 600)}
                        alt={`${release.title} by ${release.artistName} – cover art`}
                        className="w-full h-full object-cover"
                        draggable={false}
                        loading="lazy"
                      />
                      {/* Cinematic gradient overlay on centre card */}
                      {release.id === activeRelease?.id && (
                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
                      )}
                      {release.featured && (
                        <Badge className="absolute top-3 right-3 bg-secondary/90 text-secondary-foreground text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                          {dict.featured}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active Release Metadata ────────────────────────────────────────── */}
      {activeRelease && (
        <div className="text-center mt-6 px-4 space-y-1.5 min-h-[90px]">
          <Badge
            variant="outline"
            className="uppercase text-xs font-mono tracking-widest border-primary/30 text-primary-foreground"
          >
            {activeRelease.type}
          </Badge>
          <h3 className="text-xl font-bold line-clamp-1 text-foreground">
            {activeRelease.title}
          </h3>
          <p className="text-sm text-muted-foreground font-medium">
            {activeRelease.artistName}
          </p>
          <p className="text-xs text-muted-foreground font-mono flex items-center justify-center gap-1.5">
            <Calendar size={12} weight="bold" aria-hidden="true" />
            {new Date(activeRelease.releaseDate).toLocaleDateString(dateLocale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      )}

      {/* ── Navigation Controls ────────────────────────────────────────────── */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-6 mt-4">
          <button
            onClick={handlePrev}
            aria-label="Previous release"
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>

          {/* Dot indicators — max 12 to keep the row tidy */}
          <div className="flex gap-1.5" role="tablist" aria-label="Release dots">
            {releases.slice(0, 12).map((r, i) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={i === selectedIndex}
                aria-label={`Go to release ${i + 1}: ${r.title}`}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`h-2 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  i === selectedIndex
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
        {selectedIndex + 1} / {total}
      </p>
    </div>
  )
}
