'use client'

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
} from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { getSquareThumbnail } from '@/lib/imageUtils'
import type { Artist } from '@/types'
import type { DialogProps } from '@/lib/component-contracts'

interface ArtistModalProps extends DialogProps {
  artist: Artist | null
}

export function ArtistModal({ artist, open, onClose }: ArtistModalProps) {
  const prefersReducedMotion = useReducedMotion()

  if (!artist) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent aria-labelledby="artist-modal-title" className="max-w-4xl w-[95vw] p-0 border-accent/30 overflow-hidden bg-background/95 backdrop-blur-xl">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          <button
            onClick={onClose}
            aria-label={`Close ${artist.name}`}
            className="absolute top-4 right-4 z-50 rounded-full bg-background/80 backdrop-blur-sm p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 border border-border"
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
          
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative aspect-square md:aspect-auto overflow-hidden">
              {getSquareThumbnail(artist.imageUrl ?? '', 800) ? (
                <motion.img
                  initial={prefersReducedMotion ? { opacity: 1 } : { scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut' }}
                  src={getSquareThumbnail(artist.imageUrl ?? '', 800)}
                  alt={`${artist.name} – artist photo`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null
                    if (placeholder) placeholder.style.display = 'flex'
                  }}
                />
              ) : null}
              <div
                className="w-full h-full min-h-[320px] bg-gradient-to-br from-card to-background flex items-center justify-center"
                style={{ display: getSquareThumbnail(artist.imageUrl ?? '', 800) ? 'none' : 'flex' }}
              >
                <span className="text-8xl font-bold text-muted-foreground/40 select-none uppercase">
                  {artist.name.slice(0, 2)}
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            </div>

            <div className="p-8 md:p-10 space-y-6 overflow-y-auto max-h-[70vh]">
              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.2, duration: prefersReducedMotion ? 0 : 0.5 }}
              >
                <h2 id="artist-modal-title" className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">{artist.name}</h2>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {artist.genres.map((genre) => (
                    <Badge 
                      key={genre} 
                      className="bg-primary/20 text-primary-foreground border-primary/30 backdrop-blur-sm uppercase font-mono text-xs tracking-wider px-3 py-1"
                    >
                      {genre}
                    </Badge>
                  ))}
                </div>
              </motion.div>

              <motion.p
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.3, duration: prefersReducedMotion ? 0 : 0.5 }}
                className="text-muted-foreground leading-relaxed font-serif text-base"
              >
                {artist.bio}
              </motion.p>

              {artist.shopUrl && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.35, duration: prefersReducedMotion ? 0 : 0.5 }}
                >
                  <a
                    href={artist.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} merch shop`}
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-secondary text-white hover:bg-secondary/90 transition-all hover:scale-105 font-bold uppercase tracking-wider"
                  >
                    <ShoppingBag size={22} weight="fill" aria-hidden="true" />
                    Darkmerch
                  </a>
                </motion.div>
              )}

              <motion.div
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: prefersReducedMotion ? 0 : 0.5 }}
                className="flex flex-wrap gap-3 pt-2"
              >
                {artist.spotifyUrl && (
                  <a 
                    href={artist.spotifyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on Spotify`}
                    className="flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-all hover:scale-105 font-medium"
                  >
                    <SpotifyLogo size={24} weight="fill" aria-hidden="true" />
                    <span className="hidden sm:inline">Spotify</span>
                  </a>
                )}
                {artist.instagramUrl && (
                  <a 
                    href={artist.instagramUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on Instagram`}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                  >
                    <InstagramLogo size={24} weight="fill" aria-hidden="true" />
                  </a>
                )}
                {artist.youtubeUrl && (
                  <a 
                    href={artist.youtubeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on YouTube`}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                  >
                    <YoutubeLogo size={24} weight="fill" aria-hidden="true" />
                  </a>
                )}
                {artist.facebookUrl && (
                  <a
                    href={artist.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on Facebook`}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                  >
                    <FacebookLogo size={24} weight="fill" aria-hidden="true" />
                  </a>
                )}
                {artist.twitterUrl && (
                  <a
                    href={artist.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on X (Twitter)`}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                  >
                    <TwitterLogo size={24} weight="fill" aria-hidden="true" />
                  </a>
                )}
                {artist.tiktokUrl && (
                  <a
                    href={artist.tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on TikTok`}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                  >
                    <TiktokLogo size={24} weight="fill" aria-hidden="true" />
                  </a>
                )}
                {artist.bandcampUrl && (
                  <a
                    href={artist.bandcampUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} on Bandcamp`}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                  >
                    <MusicNote size={24} weight="fill" aria-hidden="true" />
                  </a>
                )}
                {artist.websiteUrl && (
                  <a 
                    href={artist.websiteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label={`${artist.name} official website`}
                    className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                  >
                    <Globe size={24} weight="fill" aria-hidden="true" />
                  </a>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
