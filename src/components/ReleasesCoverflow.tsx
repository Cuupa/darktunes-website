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
 */
const TWEEN_CUTOFF = VIRTUAL_BUFFER
const ROTATION_DEGREES_PER_SLIDE = 55
const Z_OFFSET_PER_SLIDE = 150
const SCALE_FACTOR_PER_SLIDE = 0.25
const MIN_SCALE = 0.4
const OPACITY_FACTOR_PER_SLIDE = 0.35

/**
 * Max pointer travel distance (px) between pointerdown and click that still
 * counts as a tap rather than a drag. Real taps move < 2 px; 5 px is safe.
 */
const DRAG_CLICK_THRESHOLD = 5

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
  // Use the exact integer snap index instead of a floating-point threshold so
  // that pointer-events are always in sync with Embla's authoritative state.
  // Any residual scroll offset after a swipe can no longer leave the centre
  // slide permanently locked behind pointer-events:none.
  const selectedSnap = api.selectedScrollSnap()

  snapList.forEach((scrollSnap, snapIndex) => {
    let diffToTarget = scrollSnap - scrollProgress

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

    const distInSlides = diffToTarget * Math.max(1, snapCount - 1)
    const abs = Math.abs(distInSlides)

    const slideNode = slideNodes[snapIndex] as HTMLElement | null
    const inner = slideNode?.firstElementChild as HTMLElement | null
    if (!inner || !slideNode) return

    // Only the exact selected slide receives pointer events.  All others are
    // locked out regardless of how close they are to centre.  This eliminates
    // the hitbox-overlap issue (3D-rotated neighbours whose 2D bounding boxes
    // extend over the centre) and the race condition where a sub-pixel residual
    // offset kept the correct slide at pointer-events:none after settling.
    const isSelected = snapIndex === selectedSnap

    if (abs > TWEEN_CUTOFF) {
      inner.style.opacity = '0'
      inner.style.filter = ''
      inner.style.pointerEvents = 'none'
      slideNode.style.pointerEvents = 'none'
      return
    }

    if (prefersReducedMotion) {
      inner.style.transform = ''
      inner.style.filter = ''
      inner.style.opacity = Math.abs(diffToTarget) < 0.15 ? '1' : '0.55'
      inner.style.pointerEvents = isSelected ? '' : 'none'
      slideNode.style.pointerEvents = isSelected ? '' : 'none'
      return
    }

    const rotateY = -distInSlides * ROTATION_DEGREES_PER_SLIDE
    const translateZ = -(abs * Z_OFFSET_PER_SLIDE)
    const scale = Math.max(MIN_SCALE, 1 - abs * SCALE_FACTOR_PER_SLIDE)
    const opacity = Math.max(0, 1 - abs * OPACITY_FACTOR_PER_SLIDE)

    inner.style.transform = `rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`
    inner.style.opacity = String(Math.max(0, opacity))
    const blurPx = Math.min(3, abs * 1.2)
    inner.style.filter = abs < 0.1 ? '' : `blur(${blurPx.toFixed(1)}px)`
    inner.style.pointerEvents = isSelected ? '' : 'none'
    slideNode.style.pointerEvents = isSelected ? '' : 'none'
  })
}

export function ReleasesCoverflow({ releases, dict, locale, autoplayMs = 0 }: ReleasesCoverflowProps) {
  const prefersReducedMotion = useReducedMotion() ?? false
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const total = releases.length

  // Synchronous drag detection: record pointer position at pointerdown,
  // measure distance at click time. No shared flags, no timeouts, no Embla events.
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

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

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [imageLoadedById, setImageLoadedById] = useState<Record<string, boolean>>({})

  const markImageLoaded = useCallback((releaseId: string) => {
    setImageLoadedById((prev) =>
      prev[releaseId] ? prev : { ...prev, [releaseId]: true },
    )
  }, [])

  const buildInitialWindow = useCallback(
    (count: number) => {
      const s = new Set<number>()
      for (let i = 0; i < Math.min(VIRTUAL_BUFFER + 1, count); i++) s.add(i)
      return s as ReadonlySet<number>
    },
    [],
  )

  const [renderedIndices, setRenderedIndices] = useState<ReadonlySet<number>>(() =>
    buildInitialWindow(total),
  )

  const releasesKey = useMemo(
    () => releases.map((r) => r.id).join(','),
    [releases],
  )

  useEffect(() => {
    setSelectedIndex(0)
    setRenderedIndices(buildInitialWindow(total))
    emblaApi?.scrollTo(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releasesKey])

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
    // 'settle' fires once the snap animation has fully completed.  Without it a
    // swipe that stops very close to (but not at) the snap point emits no further
    // 'scroll' events, so pointer-events on the newly centred slide is never
    // restored.  The settle handler guarantees one final clean tween call.
    emblaApi.on('settle', onTween)
    onSelect()
    return () => {
      emblaApi.off('scroll', onTween)
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
      emblaApi.off('settle', onTween)
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
      <div className="overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
        <div style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}>
          <div ref={emblaRef} className="overflow-visible" style={{ transformStyle: 'preserve-3d' }}>
            <div className="flex" style={{ transformStyle: 'preserve-3d' }}>
              {releases.map((release, index) => {
                const isActive = release.id === activeRelease?.id
                const imageLoaded = imageLoadedById[release.id] ?? false

                return (
                  <div
                    key={release.id}
                    className="flex-none w-[60vw] md:w-[42vw] lg:w-[26vw] max-w-[440px] px-3"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
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
                          onPointerDown={(e) => {
                            pointerDownPos.current = { x: e.clientX, y: e.clientY }
                          }}
                          onClick={(e) => {
                            // Synchronous drag check: measure distance from pointerdown.
                            // If the pointer moved more than DRAG_CLICK_THRESHOLD px,
                            // it was a swipe — suppress navigation. Otherwise allow it.
                            if (pointerDownPos.current) {
                              const dx = e.clientX - pointerDownPos.current.x
                              const dy = e.clientY - pointerDownPos.current.y
                              pointerDownPos.current = null
                              if (Math.sqrt(dx * dx + dy * dy) > DRAG_CLICK_THRESHOLD) {
                                e.preventDefault()
                                e.stopPropagation()
                                return
                              }
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
                            {release.featured && (
                              <Badge className="absolute top-3 right-3 bg-secondary/90 text-secondary-foreground text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                                {dict.featured}
                              </Badge>
                            )}
                          </div>
                        </Link>
                      ) : (
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

      {/* ── Active Release Metadata — also navigates to the release page ── */}
      {activeRelease && (
        <Link
          href={`/releases/${activeRelease.id}`}
          className="block text-center mt-6 px-4 space-y-1.5 min-h-[90px] hover:opacity-80 transition-opacity"
          aria-label={`${activeRelease.title} – details`}
        >
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
        </Link>
      )}

      {/* ── Navigation Controls ─────────────────────────────────────────── */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-6 mt-4">
          <button
            onClick={handlePrev}
            aria-label="Previous release"
            className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>

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
