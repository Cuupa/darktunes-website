'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Hero } from '@/components/Hero'
import { Releases } from '@/components/Releases'
import { News } from '@/components/News'
import { Videos } from '@/components/Videos'
import { Concerts } from '@/components/Concerts'
import { Footer } from '@/components/Footer'
import { NewsletterSection } from '@/components/NewsletterSection'
import { DEFAULT_SECTION_ORDER } from '@/config/sections'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Release, NewsPost, Video, SiteSettings, Concert, HomepageSection, Artist } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import { selectHeroItems } from '@/lib/heroItems'

interface HomePageContentProps {
  releases: Release[]
  news: NewsPost[]
  videos: Video[]
  concerts: Concert[]
  siteSettings: SiteSettings
  artists?: Artist[]
  dict: Dictionary
  locale: Locale
}

const SpotifyMultiPlayer = dynamic(
  () => import('@/components/SpotifyMultiPlayer').then((module) => module.SpotifyMultiPlayer),
  {
    ssr: false,
    loading: () => <div className="h-[352px] rounded-md bg-muted/40 animate-pulse" aria-hidden="true" />,
  },
)

/**
 * Client Component that renders the full home page.
 * Data is fetched server-side in app/page.tsx (RSC) and passed as props.
 * This component handles all interactive UI — animations, modals, smooth scroll.
 *
 * The `dict` prop is loaded server-side and distributed to child components
 * following the Inversion of Control principle: no child needs to load its
 * own translations.
 */
export function HomePageContent({
  releases,
  news,
  videos,
  concerts,
  siteSettings,
  artists,
  dict,
  locale,
}: HomePageContentProps) {
  const prefersReducedMotion = useReducedMotion()
  const heroItems = useMemo<(Release | NewsPost)[]>(() => {
    return selectHeroItems(releases, news, siteSettings)
  }, [releases, news, siteSettings])

  const heroItemsKey = useMemo(() => heroItems.map((item) => item.id).join('|'), [heroItems])
  const [heroState, setHeroState] = useState<{ key: string; index: number }>({ key: '', index: 0 })
  const heroIndex = heroState.key === heroItemsKey ? heroState.index : 0

  useEffect(() => {
    if (heroItems.length <= 1) return
    const intervalId = setInterval(() => {
      setHeroState((previousState) => ({
        key: heroItemsKey,
        index:
          previousState.key === heroItemsKey
            ? (previousState.index + 1) % heroItems.length
            : 1 % heroItems.length,
      }))
    }, 6000)
    return () => clearInterval(intervalId)
  }, [heroItemsKey, heroItems.length])

  const currentHeroItem = heroItems[heroIndex] ?? heroItems[0]

  // Resolve the artist slug for the "Explore Artist" secondary hero button.
  // Looks up the artist by artistId from the pre-fetched artists list so no
  // additional network request is needed at render time.
  const heroArtistSlug = useMemo<string | undefined>(() => {
    const artistId = currentHeroItem && 'artistId' in currentHeroItem ? currentHeroItem.artistId : undefined
    if (!artistId || !artists?.length) return undefined
    return artists.find((a) => a.id === artistId)?.slug
  }, [currentHeroItem, artists])
  const playlists =
    siteSettings.spotifyPlaylists?.length
      ? siteSettings.spotifyPlaylists
      : [{ label: 'Label Playlist', uri: siteSettings.spotifyPlaylistUri }]

  const sectionOrder = siteSettings.homepageSectionOrder ?? DEFAULT_SECTION_ORDER

  function renderSection(section: HomepageSection) {
    switch (section) {
      case 'releases':
        return (
          <motion.div
            key="releases"
            id="releases"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
          >
            <Releases
              releases={releases}
              dict={{
                ...dict.releases,
                ...(siteSettings.releasesSectionHeading && { heading: siteSettings.releasesSectionHeading }),
                ...(siteSettings.releasesSectionSubheading && { subheading: siteSettings.releasesSectionSubheading }),
              }}
              locale={locale}
              autoplayMs={siteSettings.carouselAutoplayMs ?? 0}
              consentDict={dict.consent}
            />
          </motion.div>
        )
      case 'spotify':
        return (
          <section key="spotify" id="spotify-player" className="py-12 px-4 lg:px-16 bg-muted/30">
            <div className="container mx-auto">
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
                className="mb-8 text-center"
              >
                <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">
                  {siteSettings.spotifySectionHeading || dict.spotify.heading}
                </h2>
                <p className="text-lg text-muted-foreground font-serif">
                  {siteSettings.spotifySectionSubheading || dict.spotify.subheading}
                </p>
              </motion.div>
              <SpotifyMultiPlayer
                playlists={playlists}
                placeholderUrl={siteSettings.consentPlaceholderUrl || undefined}
                loadLabel={dict.consent.loadSpotify}
              />
            </div>
          </section>
        )
      case 'videos':
        return (
          <div key="videos" id="videos">
            <Videos
              videos={videos}
              placeholderUrl={siteSettings.consentPlaceholderUrl || undefined}
              dict={{
                ...dict.videos,
                ...(siteSettings.videosSectionHeading && { heading: siteSettings.videosSectionHeading }),
                ...(siteSettings.videosSectionSubheading && { subheading: siteSettings.videosSectionSubheading }),
              }}
              consentDict={dict.consent}
              locale={locale}
              videosPerPage={siteSettings.videosPerPage}
              videosLinkToPage={siteSettings.videosLinkToPage}
            />
          </div>
        )
      case 'concerts':
        return (
          <div key="concerts" id="concerts">
            <Concerts
              concerts={concerts}
              dict={{
                ...dict.concerts,
                ...(siteSettings.concertsSectionHeading && { heading: siteSettings.concertsSectionHeading }),
                ...(siteSettings.concertsSectionSubheading && { subheading: siteSettings.concertsSectionSubheading }),
              }}
              locale={locale}
            />
          </div>
        )
      case 'news':
        return (
          <div key="news" id="news">
            <News
              news={news}
              dict={{
                ...dict.news,
                ...(siteSettings.newsSectionHeading && { heading: siteSettings.newsSectionHeading }),
                ...(siteSettings.newsSectionSubheading && { subheading: siteSettings.newsSectionSubheading }),
              }}
              locale={locale}
              sneakPeekCount={siteSettings.homepageNewsCount}
            />
          </div>
        )
      case 'newsletter':
        return (
          <div key="newsletter" id="newsletter">
            <NewsletterSection
              dict={{
                ...dict.newsletter,
                ...(siteSettings.newsletterHeading && { heading: siteSettings.newsletterHeading }),
                ...(siteSettings.newsletterDescription && { description: siteSettings.newsletterDescription }),
              }}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <main id="main-content">
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentHeroItem?.id ?? 'hero'}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeInOut' }}
            >
              <Hero heroItem={currentHeroItem} siteSettings={siteSettings} artistSlug={heroArtistSlug} dict={dict.hero} />
            </motion.div>
          </AnimatePresence>
          {heroItems.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {heroItems.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHeroState({ key: heroItemsKey, index: i })}
                  aria-label={`Show hero item ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === heroIndex ? 'bg-accent scale-125' : 'bg-muted-foreground/50 hover:bg-muted-foreground'}`}
                />
              ))}
            </div>
          )}
        </div>

        {sectionOrder.map((section) => renderSection(section))}
      </main>
      <Footer siteSettings={siteSettings} dict={dict.footer} />
    </div>
  )
}
