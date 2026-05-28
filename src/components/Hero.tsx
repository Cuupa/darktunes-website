'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, useInView } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, ArrowDown } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Release, NewsPost, SiteSettings } from '@/types'
import type { Dictionary } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface HeroProps extends SectionProps {
  featuredRelease?: Release
  featuredNews?: NewsPost
  siteSettings: SiteSettings
  dict: Dictionary['hero']
}

export function Hero({ featuredRelease, featuredNews, siteSettings, dict }: HeroProps) {
  const prefersReducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  // Stop the bounce animation as soon as the hero scrolls out of view so the
  // Framer Motion rAF loop doesn't keep running while the user reads below.
  const isInView = useInView(sectionRef, { margin: '0px 0px -20% 0px' })

  const isNewsMode = siteSettings.heroContentType === 'news'

  // Select which item to display
  const activeNews = isNewsMode ? featuredNews : undefined
  const activeRelease = !isNewsMode ? featuredRelease : undefined

  if (!activeNews && !activeRelease) {
    return null
  }

  const handleSmoothScroll = (targetId: string) => {
    const target = document.querySelector(targetId)
    if (target) {
      const headerOffset = 140
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - headerOffset
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' })
    }
  }

  // Determine the background image
  let bgUrl: string | undefined
  if (siteSettings.heroCustomBgUrl) {
    bgUrl = getOptimizedImageUrl(siteSettings.heroCustomBgUrl, 1200)
  } else if (activeRelease) {
    const coverUrl = getOptimizedImageUrl(activeRelease.coverArt, 1200)
    bgUrl = activeRelease.heroBgUrl
      ? getOptimizedImageUrl(activeRelease.heroBgUrl, 1200)
      : coverUrl
  } else if (activeNews?.imageUrl) {
    bgUrl = getOptimizedImageUrl(activeNews.imageUrl, 1200)
  }

  // Title / subtitle / description
  const heroTitle = activeRelease ? activeRelease.title : (activeNews?.title ?? '')
  const heroSubtitle = activeRelease ? activeRelease.artistName : undefined
  const heroDescription = activeRelease
    ? (activeRelease.promoText || siteSettings.heroDescription)
    : (activeNews?.excerpt || siteSettings.heroDescription)
  const heroLink = activeRelease
    ? `/releases/${activeRelease.id}`
    : `/news/${activeNews?.slug ?? ''}`
  const coverImageUrl = activeRelease
    ? getOptimizedImageUrl(activeRelease.coverArt, 800)
    : activeNews?.imageUrl
    ? getOptimizedImageUrl(activeNews.imageUrl, 800)
    : undefined

  return (
    <section id="hero" ref={sectionRef} className="relative min-h-screen flex items-center justify-center pt-28 md:pt-32 pb-16">
      {/* Hero background — using <img> instead of CSS background-image so the
          browser can apply fetchPriority="high" and start loading the LCP
          image as early as possible, before CSSOM construction completes. */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {bgUrl && (
          <img
            src={bgUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center"
            sizes="100vw"
            fetchPriority="high"
            loading="eager"
            decoding="sync"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, rgba(var(--background-rgb), 0.65), rgba(var(--background-rgb), 0.97))`,
          }}
        />
      </div>
      
      <div className="container mx-auto px-4 lg:px-16 z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: prefersReducedMotion ? 0 : 0.2 }}
            className="space-y-8"
          >
            <Badge className="bg-secondary/90 text-secondary-foreground uppercase tracking-wider font-bold text-sm px-4 py-2 backdrop-blur-sm">
              {siteSettings.heroBadge}
            </Badge>
            
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-none tracking-tight">
                {heroTitle}
              </h1>
              {heroSubtitle && (
                <p className="text-xl sm:text-3xl md:text-4xl lg:text-5xl text-muted-foreground font-medium font-serif">
                  {heroSubtitle}
                </p>
              )}
            </div>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl font-serif leading-relaxed">
              {heroDescription}
            </p>

            <div className="flex flex-wrap gap-4 items-center">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold uppercase tracking-wider text-base px-8 py-6"
                asChild
              >
                <Link href={heroLink}>
                  <Play className="mr-2" weight="fill" size={20} aria-hidden="true" />
                  {isNewsMode ? dict.readMore ?? 'Read More' : dict.listenNow}
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 font-bold uppercase tracking-wider text-base px-8 py-6 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={() => handleSmoothScroll(isNewsMode ? '#news' : '#artists')}
              >
                {dict.exploreArtist}
              </Button>
            </div>
          </motion.div>

          {coverImageUrl && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.8, delay: prefersReducedMotion ? 0 : 0.4 }}
              className="relative hidden lg:block"
            >
              <div className="glow-card relative aspect-square rounded-lg overflow-hidden shadow-2xl shadow-accent/20">
                <img 
                  src={coverImageUrl}
                  alt={heroTitle}
                  className="w-full h-full object-cover"
                  sizes="50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scroll-down indicator — bounce animation stops when hero leaves the
          viewport to prevent a permanent rAF loop while the page is scrolled. */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-muted-foreground"
        animate={(!prefersReducedMotion && isInView) ? { y: [0, 10, 0] } : { y: 0 }}
        transition={
          (!prefersReducedMotion && isInView)
            ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0 }
        }
      >
        <p className="text-sm uppercase tracking-widest font-mono">{dict.scrollDown}</p>
        <ArrowDown size={20} weight="bold" />
      </motion.div>
    </section>
  )
}
