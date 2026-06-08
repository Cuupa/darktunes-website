'use client'

import { Card } from '@/components/ui/card'
import { motion, useReducedMotion } from 'framer-motion'
import { ConsentGate } from '@/components/ConsentGate'
import { MusicNote, SpotifyLogo } from '@phosphor-icons/react'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'

interface SpotifyPlayerProps {
  trackUri?: string
  playlistUri?: string
  artistUri?: string
  /** Optional R2 placeholder image URL shown before consent is given. */
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

export function SpotifyPlayer({ trackUri, playlistUri, artistUri, placeholderUrl, loadLabel, gateTitle, gateText, privacyPolicyLabel }: SpotifyPlayerProps) {
  const spotifyUri = trackUri || playlistUri || artistUri
  const prefersReducedMotion = useReducedMotion()

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border p-6 shadow-xl">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {spotifyUri ? (
          <ConsentGate
            label={loadLabel ?? 'Load Spotify Player'}
            title={gateTitle}
            providerIcon={<SpotifyLogo size={20} weight="fill" className="text-[#1DB954]" aria-hidden="true" />}
            placeholderUrl={placeholderUrl}
            gateText={gateText}
            privacyPolicyUrl="/datenschutz"
            privacyPolicyLabel={privacyPolicyLabel}
          >
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
