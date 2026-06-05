'use client'

import { useState, useMemo, useDeferredValue } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  InstagramLogo,
  SpotifyLogo,
  YoutubeLogo,
  Globe,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  MusicNote,
  ShoppingBag,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { getSquareThumbnail } from '@/lib/imageUtils'
import type { Artist } from '@/types'
import type { Dictionary } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface ArtistsProps extends SectionProps {
  artists: Artist[]
  dict: Dictionary['artists']
}

const MAX_VISIBLE = 6

// Variants for the card list — Framer Motion batches all stagger timers
// inside a single IntersectionObserver + AnimationFrame scheduler, reducing
// overhead vs. per-item `whileInView` with individual observers.
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6 } },
}

/** Deterministic sort: featured first, then alphabetically by name. */
function sortArtists(items: Artist[]): Artist[] {
  return [...items].sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return a.name.localeCompare(b.name)
  })
}

export function Artists({ artists, dict }: ArtistsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  // Defer search filtering so the input updates instantly while the heavier
  // filter+render work runs as a low-priority React update.
  const deferredSearch = useDeferredValue(searchQuery)

  /** True while deferred search hasn't yet caught up with the current input. */
  const isFilterPending = deferredSearch !== searchQuery

  const sortedArtists = useMemo(() => sortArtists(artists), [artists])

  const normalisedQuery = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch])

  const filteredArtists = useMemo(() => {
    if (normalisedQuery) {
      return artists.filter(
        (artist) =>
          artist.name.toLowerCase().includes(normalisedQuery) ||
          artist.genres.some((genre) => genre.toLowerCase().includes(normalisedQuery)),
      )
    }
    return showAll ? sortedArtists : sortedArtists.slice(0, MAX_VISIBLE)
  }, [normalisedQuery, artists, sortedArtists, showAll])

  const hasMore = !normalisedQuery && artists.length > MAX_VISIBLE

  return (
    <>
      <section id="artists" className="py-24 px-4 lg:px-16 bg-card/20 scroll-mt-36">
      <div className="container mx-auto">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="mb-12"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">{dict.heading}</h2>
          <p className="text-xl text-muted-foreground font-serif">{dict.subheading}</p>
        </motion.div>

        <div className="relative mb-6">
          <MagnifyingGlass
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={dict.searchPlaceholder}
            className="h-11 w-full rounded-md border border-border bg-muted pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={dict.searchPlaceholder}
          />
        </div>

        {filteredArtists.length === 0 ? (
          <p className="text-muted-foreground font-serif">{dict.noResults}</p>
        ) : (
          <motion.ul
            className={`list-none flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-4 sm:grid sm:grid-cols-2 sm:overflow-x-visible sm:gap-8 sm:pb-0 lg:grid-cols-3 transition-opacity duration-150 ${isFilterPending ? 'opacity-60' : 'opacity-100'}`}
            variants={prefersReducedMotion ? undefined : listVariants}
            initial={prefersReducedMotion ? { opacity: 1 } : 'hidden'}
            whileInView={prefersReducedMotion ? { opacity: 1 } : 'visible'}
            viewport={{ once: true }}
          >
            {filteredArtists.map((artist) => {
              const thumbUrl = getSquareThumbnail(artist.imageUrl ?? '', 800)
              return (
              <motion.li
                key={artist.id}
                className="flex-none w-[78vw] snap-start sm:w-auto"
                variants={prefersReducedMotion ? undefined : itemVariants}
              >
                <Card
                  className="glow-card group bg-card border-border overflow-hidden hover:border-primary/50 transition-all duration-300 h-full relative"
                >
                  {/* Stretched link — navigates to artist detail page. Social icons sit above via z-[2]. */}
                  <Link
                    href={`/artists/${artist.slug}`}
                    className="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-[inherit]"
                    aria-label={`${artist.name} – view profile`}
                  />
                  <div className="relative aspect-square overflow-hidden">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        alt={`${artist.name} – artist photo`}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        style={{ transformOrigin: 'center' }}
                        sizes="(max-width: 640px) 78vw, (max-width: 1024px) 50vw, 33vw"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null
                          if (placeholder) placeholder.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-full bg-gradient-to-br from-card to-background flex items-center justify-center"
                      style={{ display: thumbUrl ? 'none' : 'flex' }}
                    >
                      <span className="text-6xl font-bold text-muted-foreground/40 select-none uppercase">
                        {artist.name.slice(0, 2)}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <h3 className="text-3xl font-bold mb-3 group-hover:text-accent transition-colors">{artist.name}</h3>
                      <div className="flex flex-wrap gap-2">
                        {artist.genres.map((genre) => (
                          <Badge key={genre} className="bg-primary/20 text-primary-foreground border-primary/30 backdrop-blur-sm uppercase font-mono text-xs tracking-wider">
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-muted-foreground font-serif line-clamp-3 leading-relaxed">
                      {artist.bio}
                    </p>
                    <div className="relative z-[2] flex flex-wrap gap-2">
                      {artist.spotifyUrl && (
                        <a
                          href={artist.spotifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} on Spotify`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <SpotifyLogo size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.instagramUrl && (
                        <a
                          href={artist.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} on Instagram`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <InstagramLogo size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.youtubeUrl && (
                        <a
                          href={artist.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} on YouTube`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <YoutubeLogo size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.facebookUrl && (
                        <a
                          href={artist.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} on Facebook`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <FacebookLogo size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.twitterUrl && (
                        <a
                          href={artist.twitterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} on X (Twitter)`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <TwitterLogo size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.tiktokUrl && (
                        <a
                          href={artist.tiktokUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} on TikTok`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <TiktokLogo size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.bandcampUrl && (
                        <a
                          href={artist.bandcampUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} on Bandcamp`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <MusicNote size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.shopUrl && (
                        <a
                          href={artist.shopUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} merch shop`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-secondary hover:text-white transition-all hover:scale-110"
                        >
                          <ShoppingBag size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                      {artist.websiteUrl && (
                        <a
                          href={artist.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${artist.name} official website`}
                          className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                        >
                          <Globe size={20} weight="fill" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.li>
              )
            })}
          </motion.ul>
        )}
        {hasMore && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className="px-6 py-2.5 rounded-md border border-border text-sm font-medium tracking-wider text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
            >
              {showAll
                ? dict.showLess
                : dict.showAll.replace('{total}', String(artists.length))}
            </button>
          </div>
        )}
      </div>
    </section>
    </>
  )
}
