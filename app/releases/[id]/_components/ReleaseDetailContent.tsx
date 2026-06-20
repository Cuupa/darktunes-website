'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Calendar,
  ArrowLeft,
  LinkSimple,
  Globe,
  SpotifyLogo,
  InstagramLogo,
  YoutubeLogo,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  MusicNote,
} from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import { ODESLI_PLATFORM_CONFIG, ODESLI_PLATFORM_ORDER } from '@/lib/platforms/odesliPlatformConfig'
import { BandcampIcon } from '@/components/icons/BandcampIcon'
import type { Release, Artist } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface ReleaseDetailContentProps {
  release: Release
  artist?: Artist | null
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
 *
 * Per-platform links: if `release.platformLinks` is populated, individual
 * platform buttons are rendered for all available services (Deezer, Tidal,
 * Amazon Music, etc.) rather than only Spotify and Apple Music.
 */
export function ReleaseDetailContent({ release, artist, dict, locale }: ReleaseDetailContentProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const prefersReducedMotion = useReducedMotion()
  const formattedDate = new Date(release.releaseDate).toLocaleDateString(dateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  /**
   * Resolve all platform URLs to display.
   * Priority order:
   *   1. Odesli-resolved `platformLinks` (most complete – includes all streaming services)
   *   2. Fallback to the individually stored spotify_url / apple_music_url / youtube_url fields
   */
  const platformEntries: Array<{ key: string; url: string }> = (() => {
    if (release.platformLinks && Object.keys(release.platformLinks).length > 0) {
      // Sort by PLATFORM_ORDER, then append any unknown keys alphabetically
      const known = ODESLI_PLATFORM_ORDER.filter((k) => release.platformLinks![k])
      const unknown = Object.keys(release.platformLinks)
        .filter((k) => !ODESLI_PLATFORM_ORDER.includes(k))
        .sort()
      return [...known, ...unknown].map((k) => ({ key: k, url: release.platformLinks![k] }))
    }
    // Fallback: use the individual URL fields
    const fallback: Array<{ key: string; url: string }> = []
    if (release.spotifyUrl)    fallback.push({ key: 'spotify',    url: release.spotifyUrl })
    if (release.appleMusicUrl) fallback.push({ key: 'appleMusic', url: release.appleMusicUrl })
    if (release.youtubeUrl)    fallback.push({ key: 'youtube',    url: release.youtubeUrl })
    if (release.bandcampUrl)   fallback.push({ key: 'bandcamp',   url: release.bandcampUrl })
    if (release.smartlinkUrl)  fallback.push({ key: 'smartlink',  url: release.smartlinkUrl })
    return fallback
  })()

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
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        <div className="relative z-10 container mx-auto px-4 lg:px-8 pt-36 pb-16">
          <Link
            href="/releases"
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
              <div className="space-y-3 pt-2">
                {/* Odesli smart link — universal hub shown first */}
                {release.smartUrl && (
                  <div>
                    <Button asChild size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
                      <a href={release.smartUrl} target="_blank" rel="noopener noreferrer">
                        <LinkSimple size={18} weight="bold" className="mr-2" aria-hidden="true" />
                        {dict.listenEverywhere}
                      </a>
                    </Button>
                  </div>
                )}

                {/* Per-platform buttons */}
                {platformEntries.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {platformEntries.map(({ key, url }) => {
                      const cfg = ODESLI_PLATFORM_CONFIG[key]
                      const Icon = cfg?.icon ?? Globe
                      const label = cfg?.label ?? key
                      const bg = cfg?.bg ?? undefined
                      const textColor = cfg?.textColor ?? 'text-white'
                      return (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Listen on ${label}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 hover:scale-105 ${textColor}`}
                          style={bg ? { backgroundColor: bg } : undefined}
                        >
                          <Icon size={14} weight="fill" aria-hidden="true" />
                          {label}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Promo / description text */}
              {release.promoText && (
                <div className="pt-2 border-t border-border/40">
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                    {dict.promoText}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {release.promoText}
                  </p>
                </div>
              )}

              {/* Artist social links */}
              {artist && (() => {
                const socialLinks = [
                  { url: artist.spotifyUrl,    icon: SpotifyLogo,    label: `${artist.name} on Spotify` },
                  { url: artist.appleMusicUrl, icon: MusicNote,      label: `${artist.name} on Apple Music` },
                  { url: artist.instagramUrl,  icon: InstagramLogo,  label: `${artist.name} on Instagram` },
                  { url: artist.youtubeUrl,    icon: YoutubeLogo,    label: `${artist.name} on YouTube` },
                  { url: artist.facebookUrl,   icon: FacebookLogo,   label: `${artist.name} on Facebook` },
                  { url: artist.twitterUrl,    icon: TwitterLogo,    label: `${artist.name} on X (Twitter)` },
                  { url: artist.tiktokUrl,     icon: TiktokLogo,     label: `${artist.name} on TikTok` },
                  { url: artist.bandcampUrl,   icon: BandcampIcon,   label: `${artist.name} on Bandcamp` },
                  { url: artist.websiteUrl,    icon: Globe,          label: `${artist.name} official website` },
                ].filter((s) => s.url)
                if (socialLinks.length === 0) return null
                return (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                      {dict.artistConnect}
                    </p>
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-2">
                        {socialLinks.map(({ url, icon: Icon, label }) => (
                          <Tooltip key={label}>
                            <TooltipTrigger asChild>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={label}
                                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                              >
                                <Icon size={20} weight="fill" aria-hidden="true" />
                              </a>
                            </TooltipTrigger>
                            <TooltipContent>{label}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  </div>
                )
              })()}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
