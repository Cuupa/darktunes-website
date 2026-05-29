'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Releases } from '@/components/Releases'
import { News } from '@/components/News'
import { Videos } from '@/components/Videos'
import { Concerts } from '@/components/Concerts'
import { Footer } from '@/components/Footer'
import { SpotifyMultiPlayer } from '@/components/SpotifyMultiPlayer'
import { NewsletterSection } from '@/components/NewsletterSection'
import { motion, useReducedMotion } from 'framer-motion'
import type { Release, NewsPost, Video, SiteSettings, Concert } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface HomePageContentProps {
  releases: Release[]
  news: NewsPost[]
  videos: Video[]
  concerts: Concert[]
  siteSettings: SiteSettings
  dict: Dictionary
  locale: Locale
}

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
  dict,
  locale,
}: HomePageContentProps) {
  const prefersReducedMotion = useReducedMotion()
  const featuredReleases = useMemo(() => {
    const featured = releases.filter((release) => release.featured)
    if (featured.length > 0) return featured
    return releases.length > 0 ? [releases[0]] : []
  }, [releases])

  const featuredNewsPost = useMemo(() => {
    if (!news.length) return undefined
    if (siteSettings.heroFeaturedId) {
      return (
        news.find(
          (n) => n.slug === siteSettings.heroFeaturedId || n.id === siteSettings.heroFeaturedId,
        ) ?? news[0]
      )
    }
    return news[0]
  }, [news, siteSettings.heroFeaturedId])

  // Build a unified hero carousel combining featured releases and the latest
  // news post so the hero can cycle through all types of content.
  const heroItems = useMemo<(Release | NewsPost)[]>(() => {
    const items: (Release | NewsPost)[] = [...featuredReleases]
    if (featuredNewsPost) items.push(featuredNewsPost)
    return items
  }, [featuredReleases, featuredNewsPost])

  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    setHeroIndex(0)
  }, [heroItems])

  useEffect(() => {
    if (heroItems.length <= 1) return
    const intervalId = setInterval(() => {
      setHeroIndex((previousIndex) => (previousIndex + 1) % heroItems.length)
    }, 6000)
    return () => clearInterval(intervalId)
  }, [heroItems])

  const currentHeroItem = heroItems[heroIndex] ?? heroItems[0]
  const playlists =
    siteSettings.spotifyPlaylists?.length
      ? siteSettings.spotifyPlaylists
      : [{ label: 'Label Playlist', uri: siteSettings.spotifyPlaylistUri }]

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <Header dict={dict.navigation} locale={locale} logoUrl={siteSettings.logoUrl} />
      <main id="main-content">
        <div className="relative">
          <Hero heroItem={currentHeroItem} siteSettings={siteSettings} dict={dict.hero} />
          {heroItems.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {heroItems.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Show release ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${i === heroIndex ? 'bg-accent scale-125' : 'bg-muted-foreground/50 hover:bg-muted-foreground'}`}
                />
              ))}
            </div>
          )}
        </div>

        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
        >
          <Releases releases={releases} dict={dict.releases} locale={locale} autoplayMs={siteSettings.carouselAutoplayMs ?? 0} consentDict={dict.consent} />
        </motion.div>

        <section id="spotify-player" className="py-12 px-4 lg:px-16 bg-muted/30">
          <div className="container mx-auto">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
              className="mb-8 text-center"
            >
              <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">{dict.spotify.heading}</h2>
              <p className="text-lg text-muted-foreground font-serif">{dict.spotify.subheading}</p>
            </motion.div>
            <SpotifyMultiPlayer
              playlists={playlists}
              placeholderUrl={siteSettings.consentPlaceholderUrl || undefined}
              loadLabel={dict.consent.loadSpotify}
            />
          </div>
        </section>

        <Videos
          videos={videos}
          placeholderUrl={siteSettings.consentPlaceholderUrl || undefined}
          dict={dict.videos}
          consentDict={dict.consent}
          locale={locale}
          videosPerPage={siteSettings.videosPerPage}
          videosLinkToPage={siteSettings.videosLinkToPage}
        />
        <Concerts concerts={concerts} dict={dict.concerts} locale={locale} />
        <News news={news} dict={dict.news} locale={locale} />

        <NewsletterSection dict={dict.newsletter} />
      </main>
      <Footer siteSettings={siteSettings} dict={dict.footer} />
    </div>
  )
}
