'use client'

import { Card } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { ConsentGate } from '@/components/ConsentGate'
import { MusicNote } from '@phosphor-icons/react'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'

interface SpotifyPlayerProps {
  trackUri?: string
  playlistUri?: string
  artistUri?: string
  /** Optional R2 placeholder image URL shown before consent is given. */
  placeholderUrl?: string
  /** Translated label for the Spotify consent gate button. */
  loadLabel?: string
}

export function SpotifyPlayer({ trackUri, playlistUri, artistUri, placeholderUrl, loadLabel }: SpotifyPlayerProps) {
  const spotifyUri = trackUri || playlistUri || artistUri

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border p-6 shadow-xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {spotifyUri ? (
          <ConsentGate label={loadLabel ?? 'Spotify laden'} placeholderUrl={placeholderUrl}>
            <iframe
              src={`https://open.spotify.com/embed${getSpotifyEmbedPath(spotifyUri)}`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-md"
            />
          </ConsentGate>
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
