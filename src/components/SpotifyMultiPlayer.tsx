'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConsentGate } from '@/components/ConsentGate'
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
