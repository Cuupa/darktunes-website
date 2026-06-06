'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
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
  CaretDown,
  CaretUp,
  Images,
} from '@phosphor-icons/react'
import { ConsentGate } from '@/components/ConsentGate'
import { VideoModal } from '@/components/VideoModal'
import { getSquareThumbnail, getOptimizedImageUrl } from '@/lib/imageUtils'
import { ODESLI_PLATFORM_CONFIG, ODESLI_PLATFORM_ORDER } from '@/lib/platforms/odesliPlatformConfig'
import type { Artist, Release, Concert, Video, NewsPost, ArtistAsset } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import { ShareButton } from './ShareButton'
import { RelatedArtists } from './RelatedArtists'
import DOMPurify from 'dompurify'

interface ArtistDetailContentProps {
  artist: Artist
  releases: Release[]
  concerts: Concert[]
  videos: Video[]
  news: NewsPost[]
  assets: ArtistAsset[]
  relatedArtists?: Artist[]
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

/** Collapsible section header with animated chevron. */
function SectionHeader({
  title,
  isOpen,
  onToggle,
  collapseLabel,
  expandLabel,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  collapseLabel: string
  expandLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex items-center gap-3 w-full text-left mb-6"
      aria-expanded={isOpen}
      aria-label={isOpen ? collapseLabel : expandLabel}
    >
      <h2 className="text-3xl font-bold tracking-tight text-foreground flex-1">
        {title}
      </h2>
      <span className="shrink-0 p-1 rounded-md text-muted-foreground group-hover:text-foreground transition-colors">
        {isOpen ? <CaretUp size={22} weight="bold" aria-hidden="true" /> : <CaretDown size={22} weight="bold" aria-hidden="true" />}
      </span>
    </button>
  )
}

export function ArtistDetailContent({
  artist,
  releases,
  concerts,
  videos,
  news,
  assets,
  relatedArtists = [],
  dict,
  consentDict,
  locale,
}: ArtistDetailContentProps) {
  const prefersReducedMotion = useReducedMotion()
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const youtubeId = artist.youtubeUrl ? extractYouTubeId(artist.youtubeUrl) : null
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)

  // Collapsible state — all sections open by default
  const [openSections, setOpenSections] = useState({
    videos: true,
    discography: true,
    news: true,
    tourDates: true,
  })

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const openVideoModal = (video: Video) => {
    setSelectedVideo(video)
    setIsVideoModalOpen(true)
  }

  const socialLinks = [
    { url: artist.spotifyUrl, icon: SpotifyLogo, label: `${artist.name} on Spotify` },
    { url: artist.appleMusicUrl, icon: MusicNote, label: `${artist.name} on Apple Music` },
    { url: artist.instagramUrl, icon: InstagramLogo, label: `${artist.name} on Instagram` },
    { url: artist.youtubeUrl, icon: YoutubeLogo, label: `${artist.name} on YouTube` },
    { url: artist.facebookUrl, icon: FacebookLogo, label: `${artist.name} on Facebook` },
    { url: artist.twitterUrl, icon: TwitterLogo, label: `${artist.name} on X (Twitter)` },
    { url: artist.tiktokUrl, icon: TiktokLogo, label: `${artist.name} on TikTok` },
    { url: artist.bandcampUrl, icon: MusicNote, label: `${artist.name} on Bandcamp` },
    { url: artist.websiteUrl, icon: Globe, label: `${artist.name} official website` },
  ]

  const collapseLabel = dict.collapse ?? 'Collapse'
  const expandLabel = dict.expand ?? 'Expand'

  const collapseVariants = {
    open: { opacity: 1, height: 'auto' },
    closed: { opacity: 0, height: 0 },
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 h-[60vh] overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden
        >
          <Image
            src={getOptimizedImageUrl(artist.imageUrl, 1400)}
            alt=""
            aria-hidden="true"
            fill
            className="object-cover opacity-20 blur-2xl scale-110"
            unoptimized
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/80 to-background" />
        </div>

        <div className="relative z-10 container mx-auto px-4 lg:px-8 pt-36 pb-16">
          <Link
            href="/artists"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-colors mb-10"
          >
            <ArrowLeft size={16} weight="bold" aria-hidden="true" />
            {dict.backToArtists}
          </Link>

          {/* Two-column hero on desktop: photo | metadata */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 lg:gap-12 items-start">
            {/* Artist photo */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
              className="w-full max-w-xs lg:w-64 xl:w-72 shrink-0 rounded-xl overflow-hidden shadow-2xl shadow-black/60"
            >
              {getSquareThumbnail(artist.imageUrl, 600) ? (
                <Image
                  src={getSquareThumbnail(artist.imageUrl, 600)}
                  alt={`${artist.name} – artist photo`}
                  width={480}
                  height={480}
                  className="w-full aspect-square object-cover"
                  unoptimized
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
              className="min-w-0 space-y-5 pt-2"
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
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-none mb-3 break-words hyphens-auto">
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
                {/* Per-platform streaming buttons from Odesli, or fallback to individual URL fields */}
                {(() => {
                  const platformLinks = artist.platformLinks
                  const platformEntries: Array<{ key: string; url: string }> = (() => {
                    if (platformLinks && Object.keys(platformLinks).length > 0) {
                      const known = ODESLI_PLATFORM_ORDER.filter((k) => platformLinks[k])
                      const unknown = Object.keys(platformLinks)
                        .filter((k) => !ODESLI_PLATFORM_ORDER.includes(k))
                        .sort()
                      return [...known, ...unknown].map((k) => ({ key: k, url: platformLinks[k] }))
                    }
                    // Fallback: use individual URL fields
                    const fallback: Array<{ key: string; url: string }> = []
                    if (artist.spotifyUrl)    fallback.push({ key: 'spotify',    url: artist.spotifyUrl })
                    if (artist.appleMusicUrl) fallback.push({ key: 'appleMusic', url: artist.appleMusicUrl })
                    if (artist.youtubeUrl)    fallback.push({ key: 'youtube',    url: artist.youtubeUrl })
                    return fallback
                  })()

                  if (platformEntries.length === 0) return null
                  return (
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
                  )
                })()}
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
                {artist.bandsintownId && (
                  <a
                    href={`https://www.bandsintown.com/a/${encodeURIComponent(artist.bandsintownId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on Bandsintown`}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 font-mono text-xs font-bold uppercase tracking-tighter"
                  >
                    BIT
                  </a>
                )}
              </div>

              {/* Share button */}
              <div className="pt-1">
                <ShareButton
                  title={artist.name}
                  text={artist.bio ? artist.bio.slice(0, 120) : undefined}
                  labels={{
                    share: dict.share,
                    shareSuccess: dict.shareSuccess,
                    shareLinkCopied: dict.shareLinkCopied,
                    shareError: dict.shareError,
                  }}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content below hero                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="container mx-auto px-4 lg:px-8 pb-24 space-y-16">

        {/* Biography + Spotify side-by-side */}
        {(artist.bio || artist.spotifyId) && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-10 items-start"
          >
            {/* Biography */}
            {artist.bio && (
              <div>
                <h2 className="text-3xl font-bold mb-6 tracking-tight text-foreground">{dict.fullBio}</h2>
                {/^\s*<[a-z]/i.test(artist.bio) ? (
                  <div
                    className="prose prose-invert max-w-none text-foreground/80 leading-relaxed font-serif
                      [&_p]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h3]:font-semibold
                      [&_a]:text-accent [&_a]:underline [&_strong]:text-foreground"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(artist.bio) }}
                  />
                ) : (
                  <p className="text-foreground/80 leading-relaxed font-serif text-base whitespace-pre-line">
                    {artist.bio}
                  </p>
                )}
              </div>
            )}

            {/* Spotify embedded player */}
            {artist.spotifyId && (
              <div className="lg:sticky lg:top-36">
                <h2 className="text-xl font-bold mb-4 tracking-tight text-foreground flex items-center gap-2">
                  <SpotifyLogo size={22} weight="fill" className="text-[#1DB954]" aria-hidden="true" />
                  {dict.listenOn}
                </h2>
                <ConsentGate label={consentDict.loadSpotify} gateText={consentDict.gateText}>
                  <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                    <iframe
                      src={`https://open.spotify.com/embed/artist/${artist.spotifyId}?utm_source=generator&theme=0`}
                      width="100%"
                      height="500"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="border-0 block"
                      title={`${artist.name} on Spotify`}
                    />
                  </div>
                </ConsentGate>
              </div>
            )}
          </motion.section>
        )}

        {/* Band Photos */}
        {assets.length > 0 && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-6 tracking-tight text-foreground flex items-center gap-2">
              <Images size={28} weight="duotone" aria-hidden="true" />
              {dict.bandPhotos}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {assets.map((asset) => (
                <motion.div
                  key={asset.id}
                  whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
                  className="relative aspect-square rounded-lg overflow-hidden bg-card border border-border cursor-pointer group"
                >
                  <Image
                    src={asset.publicUrl}
                    alt={asset.filename ?? `${artist.name} photo`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Videos */}
        {(videos.length > 0 || youtubeId) && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <SectionHeader
              title={dict.latestVideo}
              isOpen={openSections.videos}
              onToggle={() => toggleSection('videos')}
              collapseLabel={collapseLabel}
              expandLabel={expandLabel}
            />
            <AnimatePresence initial={false}>
              {openSections.videos && (
                <motion.div
                  key="videos-body"
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={collapseVariants}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  {videos.length > 0 ? (
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
                              className="relative aspect-video w-full overflow-hidden cursor-pointer"
                              onClick={() => openVideoModal(video)}
                              aria-label={`Play ${video.title}`}
                            >
                              <Image
                                src={getOptimizedImageUrl(video.thumbnailUrl, 600)}
                                alt={`${video.title} – video thumbnail`}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                unoptimized
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
                  ) : youtubeId ? (
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
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
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
            <SectionHeader
              title={dict.discography}
              isOpen={openSections.discography}
              onToggle={() => toggleSection('discography')}
              collapseLabel={collapseLabel}
              expandLabel={expandLabel}
            />
            <AnimatePresence initial={false}>
              {openSections.discography && (
                <motion.div
                  key="discography-body"
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={collapseVariants}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
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
                              <Image
                                src={getOptimizedImageUrl(release.coverArt, 400)}
                                alt={`${release.title} by ${artist.name} – cover art`}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                unoptimized
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
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {/* Latest News */}
        {news.length > 0 && (
          <motion.section
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          >
            <SectionHeader
              title={dict.news}
              isOpen={openSections.news}
              onToggle={() => toggleSection('news')}
              collapseLabel={collapseLabel}
              expandLabel={expandLabel}
            />
            <AnimatePresence initial={false}>
              {openSections.news && (
                <motion.div
                  key="news-body"
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={collapseVariants}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <ul className="space-y-4 list-none max-w-3xl">
                    {news.map((post) => (
                      <li key={post.id}>
                        <Link
                          href={`/news/${post.slug}`}
                          className="group flex gap-4 p-4 rounded-xl bg-card border border-border hover:border-accent/40 transition-colors"
                        >
                          {post.imageUrl && (
                            <Image
                              src={getOptimizedImageUrl(post.imageUrl, 120)}
                              alt={`${post.title} – news thumbnail`}
                              width={80}
                              height={80}
                              className="w-20 h-20 object-cover rounded-lg shrink-0"
                              unoptimized
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                              {new Date(post.publishedAt).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </p>
                            <h3 className="font-bold line-clamp-2 group-hover:text-accent transition-colors">{post.title}</h3>
                            {post.excerpt && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{post.excerpt}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        {/* Tour Dates */}
        <motion.section
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        >
          <SectionHeader
            title={dict.tourDates}
            isOpen={openSections.tourDates}
            onToggle={() => toggleSection('tourDates')}
            collapseLabel={collapseLabel}
            expandLabel={expandLabel}
          />
          <AnimatePresence initial={false}>
            {openSections.tourDates && (
              <motion.div
                key="tour-body"
                initial="closed"
                animate="open"
                exit="closed"
                variants={collapseVariants}
                transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                {concerts.length === 0 ? (
                  <p className="text-foreground/70 font-serif">{dict.noShows}</p>
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
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Related Artists */}
        {relatedArtists.length > 0 && (
          <RelatedArtists artists={relatedArtists} heading={dict.relatedArtists} />
        )}
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
