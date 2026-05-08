'use client'

import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { Releases } from '@/components/Releases'
import { Artists } from '@/components/Artists'
import { News } from '@/components/News'
import { Videos } from '@/components/Videos'
import { Footer } from '@/components/Footer'
import { CRTOverlay } from '@/components/CRTOverlay'
import { SpotifyPlayer } from '@/components/SpotifyPlayer'
import { motion } from 'framer-motion'
import type { Release, Artist, NewsPost, Video } from '@/types'

interface HomePageContentProps {
  releases: Release[]
  artists: Artist[]
  news: NewsPost[]
  videos: Video[]
}

/**
 * Client Component that renders the full home page.
 * Data is fetched server-side in app/page.tsx (RSC) and passed as props.
 * This component handles all interactive UI — animations, modals, smooth scroll.
 */
export function HomePageContent({ releases, artists, news, videos }: HomePageContentProps) {
  const featuredRelease =
    releases.length > 0 ? releases.find((r) => r.featured) ?? releases[0] : undefined

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <CRTOverlay />
      <Header />
      <main>
        <Hero featuredRelease={featuredRelease} />

        <section id="releases" className="relative">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Releases releases={releases} />
          </motion.div>
        </section>

        <section id="spotify-player" className="py-12 px-4 lg:px-16 bg-muted/30">
          <div className="container mx-auto max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-8 text-center"
            >
              <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">SPOTIFY</h2>
              <p className="text-lg text-muted-foreground font-serif">Listen to our playlist</p>
            </motion.div>
            <SpotifyPlayer playlistUri="37i9dQZF1DWWqNV5cS50j6" />
          </div>
        </section>

        <Artists artists={artists} />
        <Videos videos={videos} />
        <News news={news} />
      </main>
      <Footer />
    </div>
  )
}
