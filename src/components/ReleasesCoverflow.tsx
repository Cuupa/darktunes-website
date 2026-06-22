'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
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

export function ReleasesCoverflow({ releases, dict, locale, autoplayMs = 0 }: ReleasesCoverflowProps) {
  const total = releases.length
  const prefersReducedMotion = useReducedMotion() ?? false
  const swiperRef = useRef<SwiperType | null>(null)
  const overlayRef = useRef<HTMLAnchorElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const formattedDates = useMemo(() => {
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
    return releases.map((release) =>
      new Date(release.releaseDate).toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    )
  }, [locale, releases])

  const disableOverlayClick = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.style.pointerEvents = 'none'
    }
  }, [])

  const enableOverlayClick = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.style.pointerEvents = ''
    }
  }, [])

  const handlePrev = useCallback(() => {
    swiperRef.current?.slidePrev()
  }, [])

  const handleNext = useCallback(() => {
    swiperRef.current?.slideNext()
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handlePrev()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleNext()
      }
    },
    [handleNext, handlePrev],
  )

  const goToIndex = useCallback(
    (index: number) => {
      if (!swiperRef.current) return

      if (total > 2) {
        swiperRef.current.slideToLoop(index)
        return
      }

      swiperRef.current.slideTo(index)
    },
    [total],
  )

  if (total === 0) {
    return null
  }

  const activeRelease = releases[activeIndex] ?? releases[0]
  const hiddenDotCount = Math.max(0, total - MAX_DOTS)
  const autoplayConfig = autoplayMs > 0 && !prefersReducedMotion
    ? { delay: autoplayMs, disableOnInteraction: false }
    : false

  return (
    <div
      className="relative py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      role="region"
      aria-label={dict.coverflowRegionLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={disableOverlayClick}
      onPointerUp={enableOverlayClick}
      onPointerCancel={enableOverlayClick}
      onTouchStart={disableOverlayClick}
      onTouchEnd={enableOverlayClick}
      onTouchCancel={enableOverlayClick}
    >
      <div
        className="relative mx-auto w-full max-w-7xl"
        data-lenis-prevent
      >
        <Swiper
          modules={[EffectCoverflow, Virtual, Keyboard, Autoplay]}
          effect="coverflow"
          virtual
          centeredSlides
          loop={total > 2}
          grabCursor
          keyboard={{ enabled: true }}
          autoplay={autoplayConfig}
          coverflowEffect={{
            rotate: 50,
            stretch: 0,
            depth: 120,
            modifier: 1,
            slideShadows: false,
          }}
          speed={prefersReducedMotion ? 0 : 400}
          slidesPerView="auto"
          onSwiper={(swiper) => {
            swiperRef.current = swiper
            setActiveIndex(swiper.realIndex)
          }}
          onSlideChange={(swiper) => {
            setActiveIndex(swiper.realIndex)
          }}
          className="pb-2"
        >
          {releases.map((release, index) => (
            <SwiperSlide
              key={release.id}
              virtualIndex={index}
              className="!w-[60vw] md:!w-[42vw] lg:!w-[26vw] max-w-[440px]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none relative aspect-square overflow-hidden rounded-lg border border-border"
              >
                <Image
                  src={getSquareThumbnail(release.coverArt, 600)}
                  alt={`${release.title} by ${release.artistName} – cover art`}
                  fill
                  sizes="(max-width: 640px) 60vw, (max-width: 1024px) 42vw, 26vw"
                  className="object-cover"
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  unoptimized
                />
                {release.featured && (
                  <Badge className="absolute right-3 top-3 bg-secondary/90 text-secondary-foreground">
                    {dict.featured}
                  </Badge>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        <Link
          ref={overlayRef}
          href={`/releases/${activeRelease.id}`}
          aria-label={`${activeRelease.title} by ${activeRelease.artistName} – ${dict.openReleaseAriaSuffix}`}
          className="absolute inset-0 z-10 m-auto aspect-square w-[60vw] md:w-[42vw] lg:w-[26vw] max-w-[440px] rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>

      <Link href={`/releases/${activeRelease.id}`} tabIndex={-1} aria-hidden="true" className="mt-6 block px-4 text-center">
        <Badge variant="outline" className="uppercase tracking-widest">
          {activeRelease.type}
        </Badge>
        <h3 className="mt-2 text-xl font-bold text-foreground">{activeRelease.title}</h3>
        <p className="mt-1 text-sm font-medium text-muted-foreground">
          {activeRelease.artists && activeRelease.artists.length > 0
            ? activeRelease.artists.map((artist) => artist.name).join(', ')
            : activeRelease.artistName}
        </p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={12} weight="bold" aria-hidden="true" />
          {formattedDates[activeIndex]}
        </p>
      </Link>

      {total > 1 && (
        <div className="mt-4 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={handlePrev}
            aria-label={dict.previousReleaseAriaLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-muted p-3 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretLeft size={20} weight="bold" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-1.5" role="group" aria-label={dict.releaseDotsAriaLabel}>
            {releases.slice(0, MAX_DOTS).map((release, index) => (
              <button
                key={release.id}
                type="button"
                onClick={() => goToIndex(index)}
                aria-pressed={index === activeIndex}
                aria-label={dict.goToReleaseAriaLabelTemplate
                  .replace('{index}', String(index + 1))
                  .replace('{title}', release.title)}
                className={cn(
                  'min-h-[44px] min-w-[44px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  'flex items-center justify-center',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2 rounded-full transition-all',
                    index === activeIndex ? 'w-6 bg-accent' : 'w-2 bg-muted-foreground/40',
                  )}
                />
              </button>
            ))}
            {hiddenDotCount > 0 && (
              <span className="pl-1 text-xs text-muted-foreground">+{hiddenDotCount}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNext}
            aria-label={dict.nextReleaseAriaLabel}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-muted p-3 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CaretRight size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-muted-foreground">
        {activeIndex + 1} / {total}
      </p>
    </div>
  )
}
