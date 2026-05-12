'use client'

import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
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
  autoplayMs?: number
}

/**
 * How many slides either side of the active slide to keep rendered in the DOM.
 *
 * With VIRTUAL_BUFFER = 3, a maximum of 7 slide contents exist in the DOM at
 * any time, regardless of how many releases are in the full catalogue.
 */
const VIRTUAL_BUFFER = 3

/**
 * Directly mutates CSS transforms on each slide's inner element to produce
 * the 3D coverflow effect.  This function is called from Embla's `scroll`
 * event — it NEVER touches React state, so there are zero component
 * re-renders on scroll.  All visual work is done by the GPU compositor via
 * `transform` and `opacity` (hardware-accelerated properties only).
 *
 * Performance: slides further than TWEEN_CUTOFF units from the active slide
 * are skipped immediately — only the 7 centre slides receive DOM mutations.
 */
const TWEEN_CUTOFF = VIRTUAL_BUFFER + 0.5

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

    // Convert the normalised scroll diff → "slide units"
    // (1 unit = one snap interval — gives clean integer values at rest)
    const distInSlides = diffToTarget * Math.max(1, snapCount - 1)
    const abs = Math.abs(distInSlides)

    const inner = slideNodes[snapIndex]?.firstElementChild as HTMLElement | null
    if (!inner) return

    // Early-exit: slides beyond the tween cutoff are invisible — skip DOM work
    if (abs > TWEEN_CUTOFF) {
      inner.style.opacity = '0'
      return
    }

    if (prefersReducedMotion) {
      // Reduced motion: no rotation or depth, just a slight opacity fade
      inner.style.transform = ''
      inner.style.opacity = Math.abs(diffToTarget) < 0.15 ? '1' : '0.55'
      return
    }

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
 * ReleasesCoverflow — a hardware-accelerated 3D Embla coverflow gallery with
 * **virtual slide windowing** for large catalogues.
 *
 * Performance design:
 * - Embla is the scroll engine (~5 KB, physics-based, zero injected CSS).
 * - Scroll-driven transforms are applied via direct DOM mutation in the
 *   `on('scroll')` callback — never via React state, never causing re-renders.
 * - Only `selectedIndex` (for the metadata panel and dot nav) lives in state;
 *   it is updated lazily via `on('select')`.
 *
 * Virtual windowing:
 * - All slide *containers* are rendered so Embla can compute the full carousel
 *   width correctly (they are lightweight empty <div> elements).
 * - Only slides within VIRTUAL_BUFFER positions of the active index have their
 *   actual image / link content rendered. Off-window slides are empty divs.
 * - When the selected index changes, `renderedIndices` expands the window in
 *   the appropriate direction.  Once an index enters the window it is never
 *   evicted (set semantics), capping peak DOM size at ~7 rich nodes while
 *   still serving as a natural LRU image cache via the browser's own cache.
 *
 * 3D CSS architecture (avoids the preserve-3d / overflow-hidden flattening trap):
 * - `perspective` lives on an outer wrapper div — NOT on the overflow-hidden
 *   Embla viewport.  This keeps the 3D context intact.
 * - `overflow-hidden` is on the Embla viewport (clips card edges only).
 * - `transform-style: preserve-3d` is on each slide's inner content wrapper.
 */
export function ReleasesCoverflow({ releases, dict, locale, autoplayMs = 0 }: ReleasesCoverflowProps) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const total = releases.length

  // Pre-compute all date strings once — avoids repeated toLocaleDateString() on every swipe
  const formattedDates = useMemo(
    () =>
      releases.map((r) =>
        new Date(r.releaseDate).toLocaleDateString(dateLocale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      ),
    [releases, dateLocale],
  )

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: total > 2,
    align: 'center',
    dragFree: false,
  })

  // React state only for the selected index — drives the metadata panel and
  // dot indicators.  Scroll progress itself never enters React state.
  const [selectedIndex, setSelectedIndex] = useState(0)

  /**
   * Stable initial window helper — extracts the setup logic so both the
   * initialiser and the reset effect can share the same computation.
   */
  const buildInitialWindow = useCallback(
    (count: number) => {
      const s = new Set<number>()
      for (let i = 0; i < Math.min(VIRTUAL_BUFFER + 1, count); i++) s.add(i)
      return s as ReadonlySet<number>
    },
    [],
  )

  /**
   * Virtual window: a Set of indices whose slide *content* is currently
   * rendered in the DOM.  We grow the window as the user navigates but never
   * shrink it, so previously seen covers stay cached in the browser and
   * re-appear instantly when the user swipes back.
   */
  const [renderedIndices, setRenderedIndices] = useState<ReadonlySet<number>>(() =>
    buildInitialWindow(total),
  )

  /**
   * Compute a stable identity key for the releases array so we can detect
   * when the parent passes a completely different filtered set.  Using a
   * derived string here is O(n) on the first render but avoids creating a
   * closure over a full array in the effect dependency.
   */
  const releasesKey = useMemo(
    () => releases.map((r) => r.id).join(','),
    [releases],
  )

  /**
   * When the releases array changes (e.g. a new search filter is applied),
   * reset virtual-window state and scroll back to slide 0.  This prevents
   * stale indices from a previous catalogue from polluting the Set and
   * ensures the active-release metadata panel is always in sync.
   */
  useEffect(() => {
    setSelectedIndex(0)
    setRenderedIndices(buildInitialWindow(total))
    emblaApi?.scrollTo(0, true /* jump, no animation */)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releasesKey])

  /** Expand the rendered window around `centre` by VIRTUAL_BUFFER either side. */
  const expandWindow = useCallback(
    (centre: number) => {
      setRenderedIndices((prev) => {
        let changed = false
        const next = new Set(prev)
        for (let offset = -VIRTUAL_BUFFER; offset <= VIRTUAL_BUFFER; offset++) {
          const idx = ((centre + offset) % total + total) % total
          if (!next.has(idx)) {
            next.add(idx)
            changed = true
          }
        }
        return changed ? next : prev
      })
    },
    [total],
  )

  const onTween = useCallback(() => {
    if (emblaApi) tweenSlides(emblaApi, prefersReducedMotion)
  }, [emblaApi, prefersReducedMotion])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    const index = emblaApi.selectedScrollSnap()
    setSelectedIndex(index)
    expandWindow(index)
    tweenSlides(emblaApi, prefersReducedMotion)
  }, [emblaApi, prefersReducedMotion, expandWindow])

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

  const isPaused = useRef(false)

  useEffect(() => {
    if (!emblaApi || (autoplayMs ?? 0) <= 0 || prefersReducedMotion || total <= 1) return
    const id = setInterval(() => {
      if (!isPaused.current) emblaApi.scrollNext()
    }, autoplayMs)
    return () => clearInterval(id)
  }, [emblaApi, autoplayMs, prefersReducedMotion, total])

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
      onMouseEnter={() => { isPaused.current = true }}
      onMouseLeave={() => { isPaused.current = false }}
      onFocus={() => { isPaused.current = true }}
      onBlur={() => { isPaused.current = false }}
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
            {releases.map((release, index) => (
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

                  Virtual windowing: when this slide is outside the rendered
                  window we render an empty aspect-square placeholder to
                  preserve Embla layout calculation.  The `aspect-square` class
                  keeps dimensions identical to the real slide so the scroll
                  physics remain accurate.

                  willChange is applied only to rendered slides (within the
                  virtual window) to avoid promoting every slide to a GPU
                  compositor layer — which exhausts VRAM on large catalogues.
                */}
                <div
                  style={
                    renderedIndices.has(index)
                      ? { transformStyle: 'preserve-3d', willChange: 'transform, opacity' }
                      : { transformStyle: 'preserve-3d' }
                  }
                >
                  {renderedIndices.has(index) ? (
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
                          sizes="(max-width: 640px) 70vw, 320px"
                          draggable={false}
                          loading="lazy"
                          decoding="async"
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
                  ) : (
                    /* Lightweight placeholder — maintains slide dimensions so
                       Embla measures the full carousel width correctly. */
                    <div
                      className="aspect-square rounded-lg bg-muted/20 border border-border/20"
                      aria-hidden="true"
                    />
                  )}
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
            {formattedDates[selectedIndex]}
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
