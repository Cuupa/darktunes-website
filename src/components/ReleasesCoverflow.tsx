'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, EffectCoverflow, Keyboard, Virtual } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper/types'
import { Badge } from '@/components/ui/badge'
import { getSquareThumbnail } from '@/lib/imageUtils'
import { cn } from '@/lib/utils'
import type { Dictionary, Locale } from '@/i18n/types'
import type { Release } from '@/types'
import 'swiper/css'
import 'swiper/css/effect-coverflow'

export interface ReleasesCoverflowProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
  autoplayMs?: number
  consentDict: Dictionary['consent']
}

const MAX_DOTS = 12
/** Hide dot indicators above this count; always show the numeric counter. */
const DOTS_THRESHOLD = 50

export function ReleasesCoverflow({ releases, dict, locale, autoplayMs = 0 }: ReleasesCoverflowProps) {
  const total = releases.length
  const prefersReducedMotion = useReducedMotion() ?? false
  const swiperRef = useRef<SwiperType | null>(null)
  const isDragging = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  /**
   * RC2 fix: internal ref tracks the real index for Swiper navigation without
   * triggering a component-wide re-render. Only displayIndex (state) is set in
   * onSlideChange so the re-render scope is limited to the metadata section.
   */
  const activeIndexRef = useRef(0)
  const [displayIndex, setDisplayIndex] = useState(0)
  const [formattedDates, setFormattedDates] = useState<string[]>([])
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set())
  /** RC3 fix: ref used to restart the CSS fade animation without DOM remount */
  const metaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
    setFormattedDates(
      releases.map((release) =>
        new Date(release.releaseDate).toLocaleDateString(dateLocale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      ),
    )
  }, [locale, releases])

  /**
   * RC3 fix: restart the CSS fade-in animation on the metadata block whenever
   * the displayed slide changes, without unmounting/remounting the DOM subtree.
   * The "force reflow" (reading offsetHeight) flushes the style change so the
   * browser treats the re-added class as a fresh animation start.
   */
  useEffect(() => {
    const el = metaRef.current
    if (!el) return
    el.classList.remove('animate-in', 'fade-in', 'duration-200')
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    void el.offsetHeight // force reflow to restart animation
    el.classList.add('animate-in', 'fade-in', 'duration-200')
  }, [displayIndex])

  /** Debounced resize handler — keeps Swiper layout in sync */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        swiperRef.current?.update()
      }, 150)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timer)
    }
  }, [])

  /** Fix pointer-down position for 5 px drag threshold */
  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    isDragging.current = false
    pointerStart.current = { x: event.clientX, y: event.clientY }
  }, [])

  /** Only mark as dragging once pointer moves > 5 px from start */
  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current) {
      const dx = event.clientX - pointerStart.current.x
      const dy = event.clientY - pointerStart.current.y
      if (Math.hypot(dx, dy) > 5) {
        isDragging.current = true
      }
    }
  }, [])

  const handleOverlayClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (isDragging.current) {
      event.preventDefault()
      isDragging.current = false
    }
  }, [])

  const handlePrev = useCallback(() => swiperRef.current?.slidePrev(), [])
  const handleNext = useCallback(() => swiperRef.current?.slideNext(), [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handlePrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNext()
      }
    },
    [handleNext, handlePrev],
  )

  /**
   * RC1 fix: Virtual module is incompatible with loop mode, so we always use
   * `slideTo` (not `slideToLoop`). goToIndex has no dependency on total.
   */
  const goToIndex = useCallback((index: number) => {
    swiperRef.current?.slideTo(index)
  }, [])

  /** Pause autoplay on hover/focus; resume on leave/blur */
  const handleMouseEnter = useCallback(() => {
    if (autoplayMs > 0) swiperRef.current?.autoplay?.stop()
  }, [autoplayMs])

  const handleMouseLeave = useCallback(() => {
    if (autoplayMs > 0) swiperRef.current?.autoplay?.start()
  }, [autoplayMs])

  const handleFocusIn = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (autoplayMs > 0 && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
      swiperRef.current?.autoplay?.stop()
    }
  }, [autoplayMs])

  const handleBlurOut = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (autoplayMs > 0 && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
      swiperRef.current?.autoplay?.start()
    }
  }, [autoplayMs])

  if (total === 0) return null

  const activeRelease = releases[displayIndex] ?? releases[0]
  const hiddenDotCount = Math.max(0, total - MAX_DOTS)
  const autoplayConfig =
    autoplayMs > 0 && !prefersReducedMotion
      ? { delay: autoplayMs, disableOnInteraction: false }
      : false

  return (
    <div
      className="relative py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      role="region"
      aria-label={dict.coverflowRegionLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocusIn}
      onBlur={handleBlurOut}
    >
      <div className="relative overflow-clip" data-lenis-prevent>
        {/*
          RC1 fix: Virtual module ensures only the slides currently in the
          viewport (plus a small buffer) are mounted in the DOM. Previously all
          752 releases were rendered simultaneously, causing a catastrophic
          initial render and Swiper lifecycle event storm.

          RC1 note: Virtual is incompatible with loop mode — loop and
          loopAdditionalSlides have been removed.
        */}
        <Swiper
          modules={[EffectCoverflow, Keyboard, Autoplay, Virtual]}
          effect="coverflow"
          centeredSlides
          virtual
          grabCursor
          keyboard={{ enabled: true }}
          autoplay={autoplayConfig}
          coverflowEffect={{
            rotate: 0,
            stretch: 0,
            depth: 120,
            modifier: 2.5,
            slideShadows: false,
          }}
          speed={prefersReducedMotion ? 0 : 400}
          slidesPerView="auto"
          onSwiper={(swiper) => {
            swiperRef.current = swiper
            activeIndexRef.current = swiper.realIndex
            setDisplayIndex(swiper.realIndex)
          }}
          onSlideChange={(swiper) => {
            /**
             * RC2 fix: update the ref immediately (no re-render cost), then
             * only update state for the metadata section below the carousel.
             * This prevents setDisplayIndex from triggering a re-render of the
             * full Swiper tree on every slide change.
             */
            activeIndexRef.current = swiper.realIndex
            setDisplayIndex(swiper.realIndex)
          }}
          className="pb-2"
        >
          {releases.map((release, index) => (
            <SwiperSlide
              key={release.id}
              virtualIndex={index}
              className="!w-[60vw] md:!w-[42vw] lg:!w-[26vw] max-w-[440px]"
            >
              {({ isActive }) => (
                /* Inactive slides navigate to that slide on click; active slide
                   uses the invisible Link overlay below for navigation. */
                <div
                  aria-hidden="true"
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-lg border transition-all duration-300',
                    isActive
                      ? 'border-accent/60 shadow-[0_8px_40px_-8px_rgba(73,54,135,0.6)] opacity-100 scale-100'
                      : 'border-border opacity-60 scale-[0.92] cursor-pointer',
                  )}
                  onClick={isActive ? undefined : () => {
                    if (!isDragging.current) goToIndex(index)
                  }}
                >
                  {/* Skeleton shown until image loads */}
                  {!loadedIds.has(release.id) && (
                    <div className="absolute inset-0 animate-pulse bg-muted z-0" />
                  )}
                  <Image
                    src={getSquareThumbnail(release.coverArt, 600)}
                    alt={`${release.title} by ${release.artistName} – cover art`}
                    fill
                    sizes="(max-width: 640px) 60vw, (max-width: 1024px) 42vw, 26vw"
                    className="object-cover relative z-10"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    unoptimized
                    onLoad={() =>
                      setLoadedIds((prev) => {
                        if (prev.has(release.id)) return prev
                        const next = new Set(prev)
                        next.add(release.id)
                        return next
                      })
                    }
                  />
                  {release.featured && (
                    <Badge className="absolute right-3 top-3 bg-secondary/90 text-secondary-foreground text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                      {dict.featured}
                    </Badge>
                  )}
                </div>
              )}
            </SwiperSlide>
          ))}
        </Swiper>

        <Link
          href={`/releases/${activeRelease.id}`}
          aria-label={`${activeRelease.title} by ${activeRelease.artistName} – ${dict.openReleaseAriaSuffix}`}
          onClick={handleOverlayClick}
          draggable={false}
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 aspect-square w-[60vw] md:w-[42vw] lg:w-[26vw] max-w-[440px] rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      {/*
        RC3 fix: the animation is now restarted via a ref + force-reflow
        useEffect (see above) instead of `key={displayIndex}` which would
        destroy and recreate this entire subtree on every slide change.
      */}
      <div ref={metaRef} className="animate-in fade-in duration-200">
        <Link
          href={`/releases/${activeRelease.id}`}
          tabIndex={-1}
          aria-hidden="true"
          className="mt-6 block px-4 text-center hover:opacity-80 transition-opacity"
        >
          <Badge variant="outline" className="uppercase text-xs font-mono tracking-widest border-primary/30 text-primary-foreground">
            {activeRelease.type}
          </Badge>
          <h3 className="mt-2 text-xl font-bold line-clamp-1 text-foreground">{activeRelease.title}</h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {activeRelease.artists && activeRelease.artists.length > 0
              ? activeRelease.artists.map((a) => a.name).join(', ')
              : activeRelease.artistName}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs font-mono text-muted-foreground">
            <Calendar size={12} weight="bold" aria-hidden="true" />
            {formattedDates[displayIndex] ?? ''}
          </p>
        </Link>
      </div>

      {/* ── Navigation ── */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={handlePrev}
            aria-label={dict.previousReleaseAriaLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-muted p-3 transition-all hover:bg-accent hover:text-accent-foreground hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>

          {/* Only show dot indicators when total ≤ DOTS_THRESHOLD */}
          {total <= DOTS_THRESHOLD && (
            <div className="flex items-center gap-1.5" role="group" aria-label={dict.releaseDotsAriaLabel}>
              {releases.slice(0, MAX_DOTS).map((release, index) => (
                <button
                  key={release.id}
                  type="button"
                  onClick={() => goToIndex(index)}
                  aria-pressed={index === displayIndex}
                  aria-label={dict.goToReleaseAriaLabelTemplate
                    .replace('{index}', String(index + 1))
                    .replace('{title}', release.title)}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'h-2 rounded-full transition-all',
                      index === displayIndex ? 'w-6 bg-accent' : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70',
                    )}
                  />
                </button>
              ))}
              {hiddenDotCount > 0 && (
                <span className="pl-1 text-xs font-mono text-muted-foreground">+{hiddenDotCount}</span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleNext}
            aria-label={dict.nextReleaseAriaLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-muted p-3 transition-all hover:bg-accent hover:text-accent-foreground hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretRight size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Always render the x / total counter */}
      <p className="mt-2 text-center text-xs font-mono text-muted-foreground">
        {displayIndex + 1} / {total}
      </p>
    </div>
  )
}
