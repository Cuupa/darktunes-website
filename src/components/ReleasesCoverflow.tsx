'use client'

import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import type { EmblaCarouselType } from 'embla-carousel'
import { useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
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
  consentDict: Dictionary['consent']
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
const TWEEN_CUTOFF = VIRTUAL_BUFFER
const ROTATION_DEGREES_PER_SLIDE = 55
const Z_OFFSET_PER_SLIDE = 150
const SCALE_FACTOR_PER_SLIDE = 0.25
const MIN_SCALE = 0.4
const OPACITY_FACTOR_PER_SLIDE = 0.35

/**
 * Calculates wrapped slide distance in a looping carousel and returns whether
 * a slide index is currently inside the active virtual-render buffer window.
 */
function isWithinVirtualBuffer(index: number, centre: number, total: number): boolean {
  if (total <= 1) return true
  const directDistance = Math.abs(index - centre)
  const wrappedDistance = total - directDistance
  return Math.min(directDistance, wrappedDistance) <= VIRTUAL_BUFFER
}

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

    // Set pointerEvents on the outer slide node (not the 3D-transformed inner)
    // so the browser's hit-test area matches the visual layout position.
    const slideNode = slideNodes[snapIndex] as HTMLElement | null
    const inner = slideNode?.firstElementChild as HTMLElement | null
    if (!inner || !slideNode) return

    // Early-exit: slides beyond the tween cutoff are invisible — skip DOM work
    if (abs > TWEEN_CUTOFF) {
      inner.style.opacity = '0'
      inner.style.filter = ''
      slideNode.style.pointerEvents = 'none'
      return
    }

    if (prefersReducedMotion) {
      // Reduced motion: no rotation or depth, just a slight opacity fade
      inner.style.transform = ''
      inner.style.filter = ''
      inner.style.opacity = Math.abs(diffToTarget) < 0.15 ? '1' : '0.55'
      slideNode.style.pointerEvents = Math.abs(diffToTarget) < 0.15 ? '' : 'none'
      return
    }

    // 3D coverflow interpolation — GPU-only properties (transform + opacity)
    const rotateY = -distInSlides * ROTATION_DEGREES_PER_SLIDE
    const translateZ = -(abs * Z_OFFSET_PER_SLIDE)
    const scale = Math.max(MIN_SCALE, 1 - abs * SCALE_FACTOR_PER_SLIDE)
    const opacity = Math.max(0, 1 - abs * OPACITY_FACTOR_PER_SLIDE)

    inner.style.transform = `rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`
    inner.style.opacity = String(Math.max(0, opacity))
    const blurPx = Math.min(3, abs * 1.2)
    inner.style.filter = abs < 0.1 ? '' : `blur(${blurPx.toFixed(1)}px)`
    // Only the centre slide (abs < 0.5) is fully interactive; side slides are
    // decorative and must not intercept pointer events meant for the front card.
    // pointerEvents is set on the outer slideNode (which is NOT 3D-transformed)
    // so the browser hit-test box aligns with the user's cursor position.
    slideNode.style.pointerEvents = abs < 0.5 ? '' : 'none'
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
 * - `transform-style: preserve-3d` is propagated through every intermediate
 *   element in the chain: outer overflow div → perspective div → embla viewport
 *   → flex container → slide outer div → slide inner div.  Any gap in this
 *   chain would flatten the 3D context and eliminate the trapez perspective.
 */
export function ReleasesCoverflow({ releases, dict, locale, autoplayMs = 0 }: ReleasesCoverflowProps) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const total = releases.length

  // Track whether the user just performed a drag gesture so we can suppress
  // the synthetic click that Embla/pointer fires after a swipe.
  const isDragging = useRef(false)
  // True only while a pointer/touch is physically held down on the carousel.
  // Used to distinguish user-initiated scroll (drag) from programmatic scrolls
  // (autoplay, prev/next buttons, dot navigation) so we never block clicks
  // that happen after a non-drag scroll settles.
  const isPointerDown = useRef(false)

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
  const [imageLoadedById, setImageLoadedById] = useState<Record<string, boolean>>({})

  /** Marks one cover image as loaded while preserving state identity if unchanged. */
  const markImageLoaded = useCallback((releaseId: string) => {
    setImageLoadedById((prev) =>
      prev[releaseId] ? prev : { ...prev, [releaseId]: true },
    )
  }, [])

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

  // Set isDragging=true when a drag starts, reset after click has had a chance to fire
  useEffect(() => {
    if (!emblaApi) return
    const onPointerDown = () => {
      isPointerDown.current = true
      isDragging.current = false
    }
    const onPointerUp = () => { isPointerDown.current = false }
    const onSettle = () => { setTimeout(() => { isDragging.current = false }, 50) }
    // Only mark as dragging when the pointer is actually held down — this prevents
    // autoplay / programmatic scrolls (prev/next/dot) from blocking subsequent clicks.
    const onDragScroll = () => { if (isPointerDown.current) isDragging.current = true }
    emblaApi.on('pointerDown', onPointerDown)
    emblaApi.on('pointerUp', onPointerUp)
    emblaApi.on('settle', onSettle)
    emblaApi.on('scroll', onDragScroll)
    return () => {
      emblaApi.off('pointerDown', onPointerDown)
      emblaApi.off('pointerUp', onPointerUp)
      emblaApi.off('settle', onSettle)
      emblaApi.off('scroll', onDragScroll)
    }
  }, [emblaApi])

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
      className="relative select-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 py-4"
      role="region"
      aria-label="Releases coverflow"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => { isPaused.current = true }}
      onMouseLeave={() => { isPaused.current = false }}
      onFocus={() => { isPaused.current = true }}
      onBlur={() => { isPaused.current = false }}
    >
      {/*
        Outer wrapper clips horizontal overflow at the section level so the page
        never scrolls sideways, while the inner Embla viewport is overflow-visible
        so that perspective-rotated adjacent slides are FULLY visible and not
        cropped at the viewport edge.

        Layout:
          [outer overflow-hidden] ← page-level horizontal clip
            [perspective wrapper] ← 3D context
              [emblaRef overflow-visible] ← Embla scrolls this but clips nothing
                [flex container] ← translated by Embla
      */}
      <div className="overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
        <div style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}>
          {/* Embla viewport: overflow-visible so rotated side cards are not clipped */}
          <div ref={emblaRef} className="overflow-visible" style={{ transformStyle: 'preserve-3d' }}>
            {/* Embla container: Embla translates this element for scrolling */}
            <div className="flex" style={{ transformStyle: 'preserve-3d' }}>
              {releases.map((release, index) => {
                const isActive = release.id === activeRelease?.id
                const imageLoaded = imageLoadedById[release.id] ?? false

                return (
                  <div
                    key={release.id}
                    // Narrower slides so adjacent cards fit in the visible area.
                    // With overflow-visible the neighbours are no longer cropped.
                    // Mobile-first: 60vw → tablet 42vw → desktop 26vw / cap 440px.
                    className="flex-none w-[60vw] md:w-[42vw] lg:w-[26vw] max-w-[440px] px-3"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/*
                      Inner wrapper: receives 3D transforms (rotateY, scale, translate3d)
                      via direct DOM mutation in tweenSlides(). Never re-renders on scroll.

                      Virtual windowing: off-window slides render an empty placeholder
                      that preserves Embla's layout calculation (same dimensions as
                      a real slide) without loading the image.
                    */}
                    <div
                      style={{
                        transformStyle: 'preserve-3d',
                        ...(isWithinVirtualBuffer(index, selectedIndex, total)
                          ? { willChange: 'transform, opacity' }
                          : {}),
                      }}
                    >
                      {renderedIndices.has(index) ? (
                        <Link
                          href={`/releases/${release.id}`}
                          aria-label={`${release.title} by ${release.artistName}`}
                          draggable={false}
                          tabIndex={isActive ? 0 : -1}
                          className="block w-full cursor-pointer touch-manipulation"
                          onClick={(e) => {
                            // Suppress navigation if the user just dragged/swiped
                            if (isDragging.current) {
                              e.preventDefault()
                              e.stopPropagation()
                            }
                          }}
                        >
                          <div
                            className={`relative aspect-square overflow-hidden rounded-lg border transition-colors duration-300 ${
                              isActive
                                ? 'border-accent/60 shadow-[0_8px_40px_-8px_rgba(73,54,135,0.6)]'
                                : 'border-border hover:border-accent/30'
                            }`}
                          >
                            {!imageLoaded && (
                              <div
                                className="absolute inset-0 bg-muted animate-pulse rounded-lg"
                                aria-hidden="true"
                              >
                                <div
                                  className="absolute inset-0 m-auto h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                            <Image
                              src={getOptimizedImageUrl(release.coverArt, 600)}
                              alt={`${release.title} by ${release.artistName} – cover art`}
                              fill
                              className={`object-cover transition-opacity duration-300 ${
                                imageLoaded ? 'opacity-100' : 'opacity-0'
                              }`}
                              sizes="(max-width: 640px) 60vw, 320px"
                              draggable={false}
                              loading="lazy"
                              onLoad={() => markImageLoaded(release.id)}
                              unoptimized
                            />
                            {/* Cinematic gradient overlay on centre card */}
                            {isActive && (
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
                )
              })}
            </div>
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
            {activeRelease.artists && activeRelease.artists.length > 0
              ? activeRelease.artists.map((a) => a.name).join(', ')
              : activeRelease.artistName}
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
          <div className="flex gap-1.5" role="group" aria-label="Release dots">
            {releases.slice(0, 12).map((r, i) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={i === selectedIndex}
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
