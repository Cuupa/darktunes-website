'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConsentGate } from '@/components/ConsentGate'
import { useLenis } from '@/components/animations/LenisProvider'
import type { SpotifyPlaylistEntry } from '@/types'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'

interface SpotifyMultiPlayerProps {
  playlists: SpotifyPlaylistEntry[]
  placeholderUrl?: string
  loadLabel?: string
}

export function SpotifyMultiPlayer({ playlists, placeholderUrl, loadLabel }: SpotifyMultiPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion()
  const lenis = useLenis()
  /** When true the iframe is interactive and the scroll-intercept overlay is hidden. */
  const [iframeInteractive, setIframeInteractive] = useState(false)
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

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border p-6 shadow-xl">
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      >
        <ConsentGate label={loadLabel ?? 'Spotify laden'} placeholderUrl={placeholderUrl}>
          <div className="relative h-[352px] rounded-md overflow-hidden">
            {playlists.map((playlist, i) => {
              const theme = playlist.theme === 'light' ? '?theme=0' : ''
              return (
                <div
                  key={playlist.uri}
                  className={`absolute inset-0 transition-opacity duration-300 ${
                    i === activeIndex
                      ? 'opacity-100 pointer-events-auto'
                      : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <iframe
                    src={`https://open.spotify.com/embed${getSpotifyEmbedPath(playlist.uri)}${theme}`}
                    title={`Spotify playlist: ${playlist.label}`}
                    width="100%"
                    height="352"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    className="rounded-md border-0"
                  />
                </div>
              )
            })}

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

          {playlists.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {playlists.map((playlist, i) => {
                const isActive = i === activeIndex
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
                    onClick={() => setActiveIndex(i)}
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
