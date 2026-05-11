'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface ReleasesCarouselProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
}

const CARD_PERSPECTIVE = 1200
const DRAG_THRESHOLD = 5

export function ReleasesCarousel({ releases, dict, locale }: ReleasesCarouselProps) {
  const prefersReducedMotion = useReducedMotion()
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const total = releases.length

  // Track drag state to prevent link clicks from firing after a real drag gesture
  const isDragging = useRef(false)

  const goTo = useCallback(
    (index: number, dir: 1 | -1) => {
      setDirection(dir)
      setCurrentIndex(((index % total) + total) % total)
    },
    [total],
  )

  const handlePrev = () => {
    setDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + total) % total)
  }

  const handleNext = () => {
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % total)
  }

  const handleDragStart = () => {
    isDragging.current = false
  }

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (Math.abs(info.offset.x) > DRAG_THRESHOLD) {
      isDragging.current = true
      if (info.offset.x < -50) handleNext()
      else if (info.offset.x > 50) handlePrev()
    }
    // Reset after the click event has had a chance to fire
    setTimeout(() => { isDragging.current = false }, 50)
  }

  const handleLinkClick = (e: React.MouseEvent) => {
    if (isDragging.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  if (total === 0) return null

  const release = releases[currentIndex]

  const variants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? 300 : -300,
      opacity: 0,
      rotateY: prefersReducedMotion ? 0 : dir > 0 ? 30 : -30,
    }),
    center: {
      x: 0,
      opacity: 1,
      rotateY: 0,
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? -300 : 300,
      opacity: 0,
      rotateY: prefersReducedMotion ? 0 : dir > 0 ? -30 : 30,
    }),
  }

  return (
    <div className="relative select-none" aria-label="Releases carousel">
      {/* 3D perspective container */}
      <div
        className="relative overflow-hidden"
        style={{ perspective: CARD_PERSPECTIVE }}
      >
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={release.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: prefersReducedMotion ? 0 : 0.4,
              ease: 'easeInOut',
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className="cursor-grab active:cursor-grabbing"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <Link
              href={`/releases/${release.id}`}
              aria-label={`${release.title} – ${release.artistName}`}
              draggable={false}
              onClick={handleLinkClick}
            >
              <Card className="glow-card bg-card border-border overflow-hidden hover:border-accent/50 transition-all duration-300 cursor-pointer">
                <div className="relative aspect-square overflow-hidden">
                  <motion.img
                    src={getOptimizedImageUrl(release.coverArt, 600)}
                    alt={`${release.title} cover`}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
                  {release.featured && (
                    <Badge className="absolute top-4 right-4 bg-secondary/90 text-secondary-foreground backdrop-blur-sm font-bold uppercase tracking-wider">
                      {dict.featured}
                    </Badge>
                  )}
                </div>
                <div className="p-6 space-y-3">
                  <Badge
                    variant="outline"
                    className="uppercase text-xs font-mono tracking-widest border-primary/30 text-primary-foreground"
                  >
                    {release.type}
                  </Badge>
                  <h3 className="text-2xl font-bold line-clamp-1 hover:text-accent transition-colors">
                    {release.title}
                  </h3>
                  <p className="text-muted-foreground font-medium">{release.artistName}</p>
                  <p className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                    <Calendar size={16} weight="bold" aria-hidden="true" />
                    {new Date(release.releaseDate).toLocaleDateString(dateLocale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </Card>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      {total > 1 && (
        <>
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={handlePrev}
              aria-label="Previous release"
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
            >
              <CaretLeft size={20} weight="bold" aria-hidden="true" />
            </button>

            {/* Dot indicators */}
            <div className="flex gap-2" role="tablist" aria-label="Carousel dots">
              {releases.map((r, i) => (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={i === currentIndex}
                  aria-label={`Go to release ${i + 1}`}
                  onClick={() => goTo(i, i > currentIndex ? 1 : -1)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? 'bg-accent w-6'
                      : 'bg-muted-foreground/40 hover:bg-muted-foreground/70'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              aria-label="Next release"
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
            >
              <CaretRight size={20} weight="bold" aria-hidden="true" />
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground font-mono mt-3">
            {currentIndex + 1} / {total}
          </p>
        </>
      )}
    </div>
  )
}
