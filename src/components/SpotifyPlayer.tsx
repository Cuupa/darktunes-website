'use client'

import { Card } from '@/components/ui/card'
import { motion, useReducedMotion } from 'framer-motion'
import { MusicNote } from '@phosphor-icons/react'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'

interface SpotifyPlayerProps {
  trackUri?: string
  playlistUri?: string
  artistUri?: string
}

export function SpotifyPlayer({ trackUri, playlistUri, artistUri }: SpotifyPlayerProps) {
  const spotifyUri = trackUri || playlistUri || artistUri
  const prefersReducedMotion = useReducedMotion()

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border p-6 shadow-xl">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {spotifyUri ? (
          <iframe
            src={`https://open.spotify.com/embed${getSpotifyEmbedPath(spotifyUri)}`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="eager"
            className="rounded-md border-0"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
            <MusicNote size={40} weight="thin" />
            <p className="text-sm font-mono uppercase tracking-widest">Playlist coming soon</p>
          </div>
        )}
      </motion.div>
    </Card>
  )
}
