'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft,
  SpotifyLogo,
  InstagramLogo,
  YoutubeLogo,
  Globe,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  MusicNote,
  ShoppingBag,
  MapPin,
  Calendar,
  Ticket,
  Play,
} from '@phosphor-icons/react'
import { ConsentGate } from '@/components/ConsentGate'
import { VideoModal } from '@/components/VideoModal'
import { getSquareThumbnail, getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Artist, Release, Concert, Video } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface ArtistDetailContentProps {
  artist: Artist
  releases: Release[]
  concerts: Concert[]
  videos: Video[]
  dict: Dictionary['artistDetail']
  consentDict: Dictionary['consent']
  locale: Locale
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([\w-]{11})/,
  )
  return match?.[1] ?? null
}

export function ArtistDetailContent({
  artist,
  releases,
  concerts,
  videos,
  dict,
  consentDict,
  locale,
}: ArtistDetailContentProps) {
  const prefersReducedMotion = useReducedMotion()
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const youtubeId = artist.youtubeUrl ? extractYouTubeId(artist.youtubeUrl) : null
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  const openVideoModal = (video: Video) => {
    setSelectedVideo(video)
    setIsVideoModalOpen(true)
  }

  const socialLinks = [
    { url: artist.spotifyUrl, icon: SpotifyLogo, label: `${artist.name} on Spotify` },
    { url: artist.instagramUrl, icon: InstagramLogo, label: `${artist.name} on Instagram` },
    { url: artist.youtubeUrl, icon: YoutubeLogo, label: `${artist.name} on YouTube` },
    { url: artist.facebookUrl, icon: FacebookLogo, label: `${artist.name} on Facebook` },
    { url: artist.twitterUrl, icon: TwitterLogo, label: `${artist.name} on X (Twitter)` },
    { url: artist.tiktokUrl, icon: TiktokLogo, label: `${artist.name} on TikTok` },
    { url: artist.bandcampUrl, icon: MusicNote, label: `${artist.name} on Bandcamp` },
    { url: artist.websiteUrl, icon: Globe, label: `${artist.name} official website` },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative">
        <div
          className="absolute inset-0 h-[60vh] overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden
        >
          <img
            src={getOptimizedImageUrl(artist.imageUrl, 1400)}
            alt=""
            className="w-full h-full object-cover opacity-20 blur-2xl scale-110"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        </div>

        <div className="relative z-10 container mx-auto px-4 lg:px-8 pt-8 pb-16">
          <Link
            href="/#artists"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors mb-10"
          >
            <ArrowLeft size={16} weight="bold" aria-hidden="true" />
            {dict.backToArtists}
          </Link>

          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
            {/* Artist photo */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
              className="w-full max-w-xs lg:max-w-sm shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/60"
            >
              {getSquareThumbnail(artist.imageUrl, 600) ? (
                <img
                  src={getSquareThumbnail(artist.imageUrl, 600)}
                  alt={`${artist.name} – artist photo`}
                  className="w-full aspect-square object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null
                    if (placeholder) placeholder.style.display = 'flex'
                  }}
                />
              ) : null}
              <div
                className="w-full aspect-square bg-gradient-to-br from-card to-background flex items-center justify-center"
                style={{ display: getSquareThumbnail(artist.imageUrl, 600) ? 'none' : 'flex' }}
              >
                <span className="text-8xl font-bold text-muted-foreground/40 select-none uppercase">
                  {artist.name.slice(0, 2)}
                </span>
              </div>
            </motion.div>

            {/* Metadata */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: prefersReducedMotion ? 0 : 0.5 }}
              className="flex-1 min-w-0 space-y-5 pt-2"
            >
              {/* Tactical FUI metadata */}
              {(artist.country || artist.foundedYear) && (
                <div className="flex flex-wrap gap-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  {artist.country && (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} aria-hidden="true" />
                      {artist.country}
                    </span>
                  )}
                  {artist.foundedYear && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} aria-hidden="true" />
                      {dict.since} {artist.foundedYear}
                    </span>
                  )}
                </div>
              )}

              <div>
                <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-none mb-3">
                  {artist.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-3">
                  {artist.genres.map((genre) => (
                    <Badge
                      key={genre}
                      className="bg-primary/20 text-primary-foreground border-primary/30 backdrop-blur-sm uppercase font-mono text-xs tracking-wider"
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                {artist.spotifyUrl && (
                  <Button asChild size="sm" className="bg-[#1DB954] hover:bg-[#1DB954]/90 text-black font-semibold">
                    <a href={artist.spotifyId
                      ? `https://song.link/s/${artist.spotifyId}`
                      : artist.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <SpotifyLogo size={18} weight="fill" className="mr-2" aria-hidden="true" />
                      {dict.listenEverywhere}
                    </a>
                  </Button>
                )}
                {artist.shopUrl && (
                  <Button asChild size="sm" className="bg-secondary hover:bg-secondary/90 text-white font-semibold">
                    <a href={artist.shopUrl} target="_blank" rel="noopener noreferrer">
                      <ShoppingBag size={18} weight="fill" className="mr-2" aria-hidden="true" />
                      {dict.shopMerch}
                    </a>
                  </Button>
                )}
              </div>

              {/* Social links */}
              <div className="flex flex-wrap gap-3 pt-1">
                {socialLinks
                  .filter((s) => s.url)
                  .map(({ url, icon: Icon, label }) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                    >
                      <Icon size={20} weight="fill" aria-hidden="true" />
                    </a>
                  ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content below hero                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="container mx-auto px-4 lg:px-8 pb-24 space-y-20">

        {/* Biography */}
        {artist.bio && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.fullBio}</h2>
            <p className="text-muted-foreground leading-relaxed font-serif text-base max-w-3xl whitespace-pre-line">
              {artist.bio}
            </p>
          </motion.section>
        )}

        {/* Videos */}
        {videos.length > 0 && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.latestVideo}</h2>
            <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 list-none">
              {videos.map((video, index) => (
                <motion.li
                  key={video.id}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.5,
                    delay: prefersReducedMotion ? 0 : index * 0.05,
                  }}
                >
                  <Card className="group overflow-hidden bg-card border-border hover:border-accent/50 transition-all duration-300">
                    <button
                      type="button"
                      className="relative aspect-video overflow-hidden cursor-pointer"
                      onClick={() => openVideoModal(video)}
                      aria-label={`Play ${video.title}`}
                    >
                      <img
                        src={getOptimizedImageUrl(video.thumbnailUrl, 600)}
                        alt={`${video.title} – video thumbnail`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/55 transition-colors flex items-center justify-center">
                        <div
                          aria-hidden="true"
                          className="bg-accent text-accent-foreground rounded-full w-16 h-16 p-0 flex items-center justify-center"
                        >
                          <Play size={26} weight="fill" aria-hidden="true" />
                        </div>
                      </div>
                    </button>
                    <div className="p-4">
                      <h3 className="font-bold line-clamp-2 group-hover:text-accent transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono mt-2">
                        {new Date(video.publishedAt).toLocaleDateString(dateLocale, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </Card>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        )}
        {videos.length === 0 && youtubeId && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.latestVideo}</h2>
            <div className="max-w-3xl">
              <ConsentGate label={consentDict.loadYouTube} gateText={consentDict.gateText}>
                <div className="aspect-video rounded-xl overflow-hidden">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title={`${artist.name} – latest video`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              </ConsentGate>
            </div>
          </motion.section>
        )}

        {/* Discography */}
        {releases.length > 0 && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.discography}</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 list-none">
              {releases.map((release, index) => (
                <motion.li
                  key={release.id}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : index * 0.05 }}
                >
                  <Link href={`/releases/${release.id}`} aria-label={`${release.title} by ${release.artistName}`}>
                    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-all duration-300 cursor-pointer">
                      <div className="relative aspect-square overflow-hidden">
                        <img
                          src={getOptimizedImageUrl(release.coverArt, 400)}
                          alt={`${release.title} cover`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <Badge
                          variant="outline"
                          className="absolute bottom-2 left-2 uppercase text-xs font-mono tracking-widest border-primary/40 text-primary-foreground bg-background/70 backdrop-blur-sm"
                        >
                          {release.type}
                        </Badge>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold line-clamp-1 group-hover:text-accent transition-colors">
                          {release.title}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {new Date(release.releaseDate).toLocaleDateString(dateLocale, {
                            year: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.section>
        )}

        {/* Tour Dates */}
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <h2 className="text-3xl font-bold mb-6 tracking-tight">{dict.tourDates}</h2>
          {concerts.length === 0 ? (
            <p className="text-muted-foreground font-serif">{dict.noShows}</p>
          ) : (
            <ul className="space-y-3 list-none max-w-2xl">
              {concerts.map((concert) => (
                <li
                  key={concert.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="text-center shrink-0">
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        {new Date(concert.concertDate).toLocaleDateString(dateLocale, { month: 'short' })}
                      </p>
                      <p className="text-2xl font-bold leading-none">
                        {new Date(concert.concertDate).getDate()}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{concert.eventName}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin size={12} aria-hidden="true" />
                        {[concert.venueName, concert.venueCity].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  {concert.ticketUrl && (
                    <a
                      href={concert.ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-all hover:scale-105 text-sm font-medium"
                      aria-label={`Tickets for ${concert.eventName}`}
                    >
                      <Ticket size={16} weight="fill" aria-hidden="true" />
                      {dict.getTickets}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
      <VideoModal
        video={selectedVideo}
        open={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        youtubeLabel={consentDict.loadYouTube}
      />
    </div>
  )
}
