'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Pause, SkipForward, SkipBack, SpeakerHigh } from '@phosphor-icons/react'
import { Slider } from '@/components/ui/slider'
import { motion, AnimatePresence } from 'framer-motion'
import { ConsentGate } from '@/components/ConsentGate'

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
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState([70])
  const currentTrack = {
    name: 'Select a track to play',
    artist: 'darkTunes Music Group',
    albumArt: ''
  }

  const spotifyUri = trackUri || playlistUri || artistUri

  const handlePlayPause = () => {
    if (spotifyUri) {
      const embedUrl = getSpotifyEmbedUrl(spotifyUri)
      window.open(embedUrl, '_blank')
    }
    setIsPlaying(!isPlaying)
  }

  const getSpotifyEmbedUrl = (uri: string) => {
    if (uri.includes('spotify.com')) {
      return uri
    }
    
    const parts = uri.split(':')
    if (parts.length === 3) {
      const type = parts[1]
      const id = parts[2]
      return `https://open.spotify.com/${type}/${id}`
    }
    
    return uri
  }

  return (
    <Card className="bg-card/80 backdrop-blur-md border-border p-6 shadow-xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-6"
      >
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            {currentTrack.albumArt ? (
              <motion.div
                key="album-art"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-20 h-20 rounded-md bg-muted flex-shrink-0 overflow-hidden"
              >
                <img
                  src={currentTrack.albumArt}
                  alt={currentTrack.name}
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-20 h-20 rounded-md bg-gradient-to-br from-primary to-secondary flex-shrink-0"
              />
            )}
          </AnimatePresence>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {currentTrack.name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10"
            onClick={() => {}}
          >
            <SkipBack weight="fill" size={20} />
          </Button>

          <Button
            size="icon"
            variant="default"
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause weight="fill" size={24} />
            ) : (
              <Play weight="fill" size={24} />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10"
            onClick={() => {}}
          >
            <SkipForward weight="fill" size={20} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <SpeakerHigh size={20} className="text-muted-foreground" />
          <Slider
            value={volume}
            onValueChange={setVolume}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground w-10 text-right">
            {volume[0]}%
          </span>
        </div>

        {spotifyUri && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
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
          </motion.div>
        )}
      </motion.div>
    </Card>
  )
}

function getSpotifyEmbedPath(uri: string): string {
  if (uri.includes('spotify.com')) {
    const url = new URL(uri)
    return url.pathname
  }
  
  const parts = uri.split(':')
  if (parts.length === 3) {
    const type = parts[1]
    const id = parts[2]
    return `/${type}/${id}`
  }
  
  return '/playlist/37i9dQZF1DXcF6B6QPhFDv'
}
