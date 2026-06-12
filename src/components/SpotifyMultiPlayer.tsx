'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConsentGate } from '@/components/ConsentGate'
import { SpotifyLogo } from '@phosphor-icons/react'
import { useLenis } from '@/components/animations/LenisProvider'
import type { SpotifyPlaylistEntry } from '@/types'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'

interface SpotifyMultiPlayerProps {
  playlists: SpotifyPlaylistEntry[]
  placeholderUrl?: string
  /** Short button label for the Spotify consent gate (e.g. "Load Spotify Player"). */
  loadLabel?: string
  /** Title shown in the consent gate (e.g. "Listen on Spotify"). */
  gateTitle?: string
  /** Explanation text for the consent gate. */
  gateText?: string
  /** Privacy policy link label. */
  privacyPolicyLabel?: string
}

export function SpotifyMultiPlayer({ playlists, placeholderUrl, loadLabel, gateTitle, gateText, privacyPolicyLabel }: SpotifyMultiPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const lenis = useLenis()
  /** When true the iframe is interactive and the scroll-intercept overlay is hidden. */
  const [iframeInteractive, setIframeInteractive] = useState(false)
  /** Click-to-load facade: defer Spotify iframe + third-party cookies until user intent. */
  const [playerActivated, setPlayerActivated] = useState(false)
  const interactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (interactTimerRef.current) clearTimeout(interactTimerRef.current)
    }
  }, [])

  const handleOverlayClick = () => {
    setIframeInteractive(true)
    if (interactTimerRef.current) clearTimeout(interactTimerRef.current)
    // Automatically restore the overlay after 5 s of Spotify interaction
    interactTimerRef.current = setTimeout(() => setIframeInteractive(false), 5000)
  }

  if (playlists.length === 0) return null
  const activePlaylist = playlists[activeIndex] ?? playlists[0]
  const activeTheme = activePlaylist.theme === 'light' ? '?theme=0' : ''

  /** Human-readable subtitle for the facade (e.g. "Darkwave" or "4 Playlists"). */
  const facadeSubtitle =
    playlists.length === 1
      ? playlists[0].label
      : playlists.length > 1
        ? `${playlists.length} Playlists`
        : ''

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border p-6 shadow-xl">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      >
        <ConsentGate
          label={loadLabel ?? 'Load Spotify Player'}
          title={gateTitle}
          providerIcon={<SpotifyLogo size={20} weight="fill" className="text-[#1DB954]" aria-hidden="true" />}
          placeholderUrl={placeholderUrl}
          gateText={gateText}
          privacyPolicyUrl="/datenschutz"
          privacyPolicyLabel={privacyPolicyLabel}
        >
          {!playerActivated ? (
            /*
              Click-to-load facade — shown after GDPR consent is accepted.
              Defers the actual Spotify iframe (and its third-party network
              requests) until the user explicitly clicks. Visually mirrors
              the ConsentGate overlay so users get consistent Spotify branding
              across all pages.
            */
            <button
              type="button"
              onClick={() => setPlayerActivated(true)}
              className="relative h-[352px] w-full rounded-xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-secondary/10 transition-colors hover:from-primary/15 hover:to-secondary/15 flex flex-col items-center justify-center gap-4 group"
              aria-label={loadLabel ?? 'Load Spotify Player'}
            >
              {/* Spotify logo */}
              <SpotifyLogo
                size={44}
                weight="fill"
                className="text-[#1DB954]"
                aria-hidden="true"
              />

              {/* Title */}
              {gateTitle && (
                <span className="text-base font-semibold text-foreground tracking-tight">
                  {gateTitle}
                </span>
              )}

              {/* Divider */}
              <div className="w-8 h-px bg-border/60" aria-hidden="true" />

              {/* Playlist count / label */}
              {facadeSubtitle && (
                <span className="text-sm text-muted-foreground">
                  {facadeSubtitle}
                </span>
              )}

              {/* CTA button */}
              <span className="mt-1 inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-semibold px-5 py-2 rounded-md group-hover:bg-primary/90 transition-colors">
                <SpotifyLogo size={14} weight="fill" aria-hidden="true" />
                {loadLabel ?? 'Load Spotify Player'}
              </span>
            </button>
          ) : (
            <div className="relative h-[352px] rounded-md overflow-hidden">
              <iframe
                src={`https://open.spotify.com/embed${getSpotifyEmbedPath(activePlaylist.uri)}${activeTheme}`}
                title={`Spotify playlist: ${activePlaylist.label}`}
                width="100%"
                height="352"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-md border-0"
              />

              {/*
                Transparent overlay that intercepts wheel events so Lenis can
                scroll the page even when the cursor is over the Spotify iframe.
                Clicking the overlay activates Spotify interaction mode for 5 s,
                after which the overlay is restored.
              */}
              {!iframeInteractive && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 z-10 cursor-pointer"
                  onWheel={(e) => {
                    lenis?.scrollTo(window.scrollY + e.deltaY, { immediate: false })
                  }}
                  onClick={handleOverlayClick}
                  title="Klicken, um den Spotify-Player zu bedienen"
                />
              )}
            </div>
          )}

          {playlists.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {playlists.map((playlist, i) => {
                const isActive = i === activeIndex
                // accentColor is a dynamic per-playlist value; inline style is intentional
                const accentStyle =
                  playlist.accentColor && isActive
                    ? { backgroundColor: playlist.accentColor, borderColor: playlist.accentColor, color: '#fff' }
                    : playlist.accentColor && !isActive
                    ? { borderColor: playlist.accentColor, color: playlist.accentColor }
                    : {}
                return (
                  <Button
                    key={playlist.uri}
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => {
                      setActiveIndex(i)
                      setIframeInteractive(false)
                    }}
                    aria-pressed={isActive}
                    className="text-xs"
                    type="button"
                    style={accentStyle}
                  >
                    {playlist.label}
                  </Button>
                )
              })}
            </div>
          )}
        </ConsentGate>
      </motion.div>
    </Card>
  )
}
