'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, ArrowLeft, SpotifyLogo, AppleLogo, YoutubeLogo, LinkSimple } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface ReleaseDetailContentProps {
  release: Release
  dict: Dictionary['releaseDetail']
  locale: Locale
}

/**
 * Client component for the release detail page.
 *
 * The `layoutId` on the cover art image matches the one used in the
 * Releases grid card, enabling Framer Motion's Shared Layout Animation:
 * the thumbnail seamlessly morphs into the large header image when the
 * user navigates from the grid to this detail page.
 *
 * Odesli smart link: if `release.smartUrl` is populated (resolved by the
 * syncAll pipeline via the Odesli API), a "Listen Everywhere" button is
 * shown that deep-links to song.link — a universal streaming hub that
 * redirects the visitor to their preferred platform.
 */
export function ReleaseDetailContent({ release, dict, locale }: ReleaseDetailContentProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const prefersReducedMotion = useReducedMotion()
  const formattedDate = new Date(release.releaseDate).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------------------------------------------ */}
      {/* Hero — shared layout cover art                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative">
        {/* Full-bleed blurred background from the cover art */}
        <div
          className="absolute inset-0 h-[70vh] overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden
        >
          <Image
            src={getOptimizedImageUrl(release.coverArt, 1200)}
            alt=""
            fill
            className="object-cover opacity-20 blur-2xl scale-110"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        <div className="relative z-10 container mx-auto px-4 lg:px-8 pt-8 pb-16">
          <Link
            href="/#releases"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors mb-10"
          >
            <ArrowLeft size={16} weight="bold" />
            {dict.backToReleases}
          </Link>

          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
            {/* Shared Layout cover art */}
            <motion.div
              layoutId={`release-cover-${release.id}`}
              className="w-full max-w-xs lg:max-w-sm shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/60"
            >
              <Image
                src={getOptimizedImageUrl(release.coverArt, 600)}
                alt={`${release.title} cover`}
                width={480}
                height={480}
                className="w-full aspect-square object-cover"
                unoptimized
              />
            </motion.div>

            {/* Metadata */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.15, duration: prefersReducedMotion ? 0 : 0.5 }}
              className="flex-1 min-w-0 space-y-5 pt-2"
            >
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="uppercase text-xs font-mono tracking-widest border-primary/30 text-primary-foreground"
                >
                  {release.type}
                </Badge>
                {release.featured && (
                  <Badge className="bg-secondary/90 text-secondary-foreground font-bold uppercase tracking-wider text-xs">
                    {dict.featured}
                  </Badge>
                )}
              </div>

              <div>
                <h1 className="text-4xl lg:text-6xl font-bold tracking-tight leading-none mb-2">
                  {release.title}
                </h1>
                <p className="text-xl text-muted-foreground font-medium">{release.artistName}</p>
              </div>

              <p className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                <Calendar size={16} weight="bold" />
                {formattedDate}
              </p>

              {/* Streaming links */}
              <div className="flex flex-wrap gap-3 pt-2">
                {/* Odesli smart link — shown first as the universal hub */}
                {release.smartUrl && (
                  <Button asChild size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                    <a href={release.smartUrl} target="_blank" rel="noopener noreferrer">
                      <LinkSimple size={18} weight="bold" className="mr-2" aria-hidden="true" />
                      {dict.listenEverywhere}
                    </a>
                  </Button>
                )}
                {release.spotifyUrl && (
                  <Button asChild size="sm" className="bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-semibold">
                    <a href={release.spotifyUrl} target="_blank" rel="noopener noreferrer">
                      <SpotifyLogo size={18} weight="fill" className="mr-2" />
                      Spotify
                    </a>
                  </Button>
                )}
                {release.appleMusicUrl && (
                  <Button asChild size="sm" className="bg-[#FA2D48] hover:bg-[#FA2D48]/90 text-white font-semibold">
                    <a href={release.appleMusicUrl} target="_blank" rel="noopener noreferrer">
                      <AppleLogo size={18} weight="fill" className="mr-2" />
                      Apple Music
                    </a>
                  </Button>
                )}
                {release.youtubeUrl && (
                  <Button asChild size="sm" className="bg-[#FF0000] hover:bg-[#FF0000]/90 text-white font-semibold">
                    <a href={release.youtubeUrl} target="_blank" rel="noopener noreferrer">
                      <YoutubeLogo size={18} weight="fill" className="mr-2" />
                      YouTube
                    </a>
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
