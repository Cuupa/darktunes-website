'use client'

import { SpotifyLogo } from '@phosphor-icons/react'
import { ConsentGate } from '@/components/ConsentGate'
import { getSpotifyEmbedPath } from '@/lib/spotifyEmbedPath'
import type { Artist } from '@/types'
import { resolveThemeColors } from '@/lib/fan-page/theme/resolveThemeColors'
import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'

interface MusicPlayerBlockProps {
  artist?: Artist
  theme: FanPageTheme
  title?: string
  spotifyUri?: string
}

export function MusicPlayerBlock({ artist, theme, title, spotifyUri }: MusicPlayerBlockProps) {
  const colors = resolveThemeColors(theme)
  const uri = spotifyUri || artist?.spotifyUrl
  const embedPath = uri ? getSpotifyEmbedPath(uri) : null

  return (
    <div>
      {title ? (
        <h2 className="mb-4 text-2xl font-bold tracking-tight" style={{ color: colors.primary }}>
          {title}
        </h2>
      ) : null}
      {embedPath ? (
        <ConsentGate
          label="Load Spotify Player"
          title="Listen on Spotify"
          providerIcon={<SpotifyLogo size={24} weight="fill" className="text-[#1DB954]" />}
        >
          <iframe
            src={`https://open.spotify.com/embed${embedPath}`}
            width="100%"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-md border-0"
            title="Spotify player"
          />
        </ConsentGate>
      ) : (
        <p className="text-sm opacity-60">—</p>
      )}
    </div>
  )
}