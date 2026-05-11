'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  X,
  SpotifyLogo,
  InstagramLogo,
  YoutubeLogo,
  Globe,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  MusicNote,
  ShoppingBag,
  Play,
  Pause,
  MapPin,
  Calendar,
  Ticket,
  ArrowRight,
} from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { ConsentGate } from '@/components/ConsentGate'
import { getSquareThumbnail } from '@/lib/imageUtils'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { isSupabaseConfigured } from '@/env'
import type { Artist, Concert } from '@/types'
import type { DialogProps } from '@/lib/component-contracts'

// ─── iTunes search result type ─────────────────────────────────────────────
interface ItunesTrack {
  trackId: number
  trackName: string
  collectionName: string
  artworkUrl60: string
  previewUrl: string | undefined
}

interface ItunesSearchResult {
  resultCount: number
  results: Array<{
    kind: string
    trackId: number
    trackName: string
    collectionName: string
    artworkUrl60: string
    previewUrl?: string
  }>
}

// ─── YouTube URL helper ─────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([\w-]{11})/,
  )
  return match?.[1] ?? null
}

// ─── Props ──────────────────────────────────────────────────────────────────
interface ArtistModalProps extends DialogProps {
  artist: Artist | null
}

// ─── Component ──────────────────────────────────────────────────────────────
export function ArtistModal({ artist, open, onClose }: ArtistModalProps) {
  const prefersReducedMotion = useReducedMotion()

  // iTunes tracks
  const [tracks, setTracks] = useState<ItunesTrack[]>([])
  const [tracksLoading, setTracksLoading] = useState(false)

  // Concerts
  const [concerts, setConcerts] = useState<Concert[]>([])

  // Audio player — only one track plays at a time
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null)
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map())

  // Bio read-more
  const BIO_LIMIT = 200
  const [bioExpanded, setBioExpanded] = useState(false)

  // Reset state when artist changes
  useEffect(() => {
    setTracks([])
    setConcerts([])
    setPlayingTrackId(null)
    setBioExpanded(false)
    audioRefs.current.forEach((a) => a.pause())
    audioRefs.current.clear()
  }, [artist?.id])

  // Fetch iTunes tracks
  useEffect(() => {
    if (!artist || !open) return
    setTracksLoading(true)
    const term = encodeURIComponent(artist.name)
    fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=5`)
      .then((res) => res.json())
      .then((data: ItunesSearchResult) => {
        const filtered = data.results
          .filter((r) => r.kind === 'song' && r.previewUrl)
          .slice(0, 5)
          .map((r) => ({
            trackId: r.trackId,
            trackName: r.trackName,
            collectionName: r.collectionName,
            artworkUrl60: r.artworkUrl60,
            previewUrl: r.previewUrl,
          }))
        setTracks(filtered)
      })
      .catch(() => {
        setTracks([])
      })
      .finally(() => setTracksLoading(false))
  }, [artist?.id, open])

  // Fetch concerts from Supabase (client-side)
  useEffect(() => {
    if (!artist || !open || !isSupabaseConfigured) return
    const db = createBrowserSupabaseClient()
    getConcertsByArtistId(db, artist.id)
      .then((data) => setConcerts(data.slice(0, 5)))
      .catch(() => setConcerts([]))
  }, [artist?.id, open])

  // Handle play/pause for a track
  const handleTogglePlay = (track: ItunesTrack) => {
    if (!track.previewUrl) return

    if (playingTrackId === track.trackId) {
      audioRefs.current.get(track.trackId)?.pause()
      setPlayingTrackId(null)
      return
    }

    // pause any currently playing track
    audioRefs.current.forEach((a, id) => {
      if (id !== track.trackId) a.pause()
    })

    let audio = audioRefs.current.get(track.trackId)
    if (!audio) {
      audio = new Audio(track.previewUrl)
      audio.addEventListener('ended', () => setPlayingTrackId(null))
      audioRefs.current.set(track.trackId, audio)
    }

    audio.play().catch(() => setPlayingTrackId(null))
    setPlayingTrackId(track.trackId)
  }

  // Pause audio on close
  const handleClose = () => {
    audioRefs.current.forEach((a) => a.pause())
    setPlayingTrackId(null)
    onClose()
  }

  if (!artist) return null

  const youtubeId = artist.youtubeUrl ? extractYouTubeId(artist.youtubeUrl) : null
  const listenUrl = artist.spotifyId
    ? `https://song.link/s/${artist.spotifyId}`
    : (artist.spotifyUrl ?? undefined)

  const bioText = artist.bio ?? ''
  const bioClamped = !bioExpanded && bioText.length > BIO_LIMIT
  const bioDisplay = bioClamped ? bioText.slice(0, BIO_LIMIT) + '…' : bioText
  const profileSlug = artist.slug?.trim()

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
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent
        aria-labelledby="artist-modal-title"
        className="max-w-2xl w-[95vw] p-0 border-accent/30 overflow-hidden bg-background/95 backdrop-blur-xl max-h-[90vh] flex flex-col"
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="flex flex-col overflow-hidden"
        >
          {/* ── Hero image with Tactical FUI overlay ── */}
          <div className="relative h-52 sm:h-64 shrink-0 overflow-hidden">
            {getSquareThumbnail(artist.imageUrl ?? '', 800) ? (
              <motion.img
                initial={prefersReducedMotion ? { opacity: 1 } : { scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut' }}
                src={getSquareThumbnail(artist.imageUrl ?? '', 800)}
                alt={`${artist.name} – artist photo`}
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null
                  if (placeholder) placeholder.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className="w-full h-full bg-gradient-to-br from-card to-background flex items-center justify-center"
              style={{ display: getSquareThumbnail(artist.imageUrl ?? '', 800) ? 'none' : 'flex' }}
            >
              <span className="text-8xl font-bold text-muted-foreground/40 select-none uppercase">
                {artist.name.slice(0, 2)}
              </span>
            </div>
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

            {/* Tactical FUI metadata */}
            <div className="absolute bottom-3 left-4 right-14">
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                {artist.country && (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} aria-hidden="true" />
                    {artist.country}
                  </span>
                )}
                {artist.foundedYear && (
                  <span className="flex items-center gap-1">
                    <Calendar size={10} aria-hidden="true" />
                    EST. {artist.foundedYear}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {artist.genres.map((genre) => (
                  <Badge
                    key={genre}
                    className="bg-primary/20 text-primary-foreground border-primary/30 backdrop-blur-sm uppercase font-mono text-[10px] tracking-widest px-2 py-0.5"
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label={`Close ${artist.name}`}
              className="absolute top-3 right-3 z-50 rounded-full bg-background/80 backdrop-blur-sm p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 border border-border"
            >
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1 px-6 pt-5 pb-6 space-y-6">
            {/* Name */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.15, duration: prefersReducedMotion ? 0 : 0.4 }}
            >
              <h2 id="artist-modal-title" className="text-3xl sm:text-4xl font-bold tracking-tight">
                {artist.name}
              </h2>
            </motion.div>

            {/* Biography */}
            {bioText && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: prefersReducedMotion ? 0 : 0.4 }}
              >
                <p className="text-muted-foreground leading-relaxed font-serif text-sm">
                  {bioDisplay}
                </p>
                {bioText.length > BIO_LIMIT && (
                  <button
                    onClick={() => setBioExpanded((v) => !v)}
                    className="mt-1 text-xs text-accent hover:underline"
                  >
                    {bioExpanded ? 'Read less' : 'Read more'}
                  </button>
                )}
              </motion.div>
            )}

            {/* Listen Everywhere + Merch */}
            {(listenUrl || artist.shopUrl) && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.25, duration: prefersReducedMotion ? 0 : 0.4 }}
                className="flex flex-wrap gap-3"
              >
                {listenUrl && (
                  <a
                    href={listenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Listen to ${artist.name} on all platforms`}
                    className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-all hover:scale-105 font-semibold text-sm"
                  >
                    <SpotifyLogo size={18} weight="fill" aria-hidden="true" />
                    Listen Everywhere
                  </a>
                )}
                {artist.shopUrl && (
                  <a
                    href={artist.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} merch shop`}
                    className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg bg-secondary text-white hover:bg-secondary/90 transition-all hover:scale-105 font-semibold text-sm"
                  >
                    <ShoppingBag size={18} weight="fill" aria-hidden="true" />
                    Shop Merch
                  </a>
                )}
              </motion.div>
            )}

            {/* iTunes tracks */}
            {(tracksLoading || tracks.length > 0) && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.3, duration: prefersReducedMotion ? 0 : 0.4 }}
              >
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Tracks
                </h3>
                {tracksLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 animate-pulse">
                        <div className="w-10 h-10 rounded bg-muted shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-muted rounded w-3/4" />
                          <div className="h-2.5 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1.5 list-none">
                    {tracks.map((track) => (
                      <li key={track.trackId}>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                          <img
                            src={track.artworkUrl60}
                            alt={`${track.collectionName} cover`}
                            className="w-10 h-10 rounded shrink-0 object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{track.trackName}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.collectionName}</p>
                          </div>
                          {track.previewUrl && (
                            <button
                              onClick={() => handleTogglePlay(track)}
                              aria-label={
                                playingTrackId === track.trackId
                                  ? `Pause ${track.trackName}`
                                  : `Play preview of ${track.trackName}`
                              }
                              className="shrink-0 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full bg-accent/20 hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                            >
                              {playingTrackId === track.trackId ? (
                                <Pause size={16} weight="fill" aria-hidden="true" />
                              ) : (
                                <Play size={16} weight="fill" aria-hidden="true" />
                              )}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}

            {/* YouTube embed */}
            {youtubeId && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.35, duration: prefersReducedMotion ? 0 : 0.4 }}
              >
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Latest Video
                </h3>
                <ConsentGate label="Load YouTube">
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
              </motion.div>
            )}

            {/* Tour dates */}
            {concerts.length > 0 && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: prefersReducedMotion ? 0 : 0.4 }}
              >
                <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  Tour Dates
                </h3>
                <ul className="space-y-2 list-none">
                  {concerts.map((concert) => (
                    <li
                      key={concert.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-card border border-border hover:border-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-center shrink-0 w-10">
                          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">
                            {new Date(concert.concertDate).toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-lg font-bold leading-none">
                            {new Date(concert.concertDate).getDate()}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{concert.eventName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin size={10} aria-hidden="true" />
                            {[concert.venueName, concert.venueCity].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      {concert.ticketUrl && (
                        <a
                          href={concert.ticketUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Tickets for ${concert.eventName}`}
                          className="shrink-0 flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg bg-accent/20 hover:bg-accent hover:text-accent-foreground transition-all text-xs font-medium"
                        >
                          <Ticket size={12} weight="fill" aria-hidden="true" />
                          Tickets
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Social links */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.45, duration: prefersReducedMotion ? 0 : 0.4 }}
              className="flex flex-wrap gap-2 pt-1"
            >
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
            </motion.div>

            {/* Full Profile link */}
            {profileSlug && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.5, duration: prefersReducedMotion ? 0 : 0.4 }}
              >
                <Link
                  href={`/artists/${profileSlug}`}
                  onClick={handleClose}
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
                >
                  Full Profile
                  <ArrowRight size={14} weight="bold" aria-hidden="true" />
                </Link>
              </motion.div>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
