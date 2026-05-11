'use client'

import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog'
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
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import type { Artist } from '@/types'

interface ArtistModalProps {
  artist: Artist | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArtistModal({ artist, open, onOpenChange }: ArtistModalProps) {
  if (!artist) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 border-accent/30 overflow-hidden bg-background/95 backdrop-blur-xl">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          <DialogClose className="absolute top-4 right-4 z-50 rounded-full bg-background/80 backdrop-blur-sm p-2.5 text-foreground hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110 border border-border">
            <X size={20} weight="bold" />
          </DialogClose>
          
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative aspect-square md:aspect-auto overflow-hidden">
              <motion.img
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                src={artist.imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            </div>

            <div className="p-8 md:p-10 space-y-6 overflow-y-auto max-h-[70vh]">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <h2 className="text-4xl lg:text-5xl font-bold mb-4 tracking-tight">{artist.name}</h2>
                
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
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-muted-foreground leading-relaxed font-serif text-base"
              >
                {artist.bio}
              </motion.p>

              {artist.shopUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                >
                  <a
                    href={artist.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-secondary text-white hover:bg-secondary/90 transition-all hover:scale-105 font-bold uppercase tracking-wider"
                  >
                    <ShoppingBag size={22} weight="fill" />
                    Darkmerch
                  </a>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex flex-wrap gap-3 pt-2"
              >
                {artist.spotifyUrl && (
                  <a 
                    href={artist.spotifyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-3 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-all hover:scale-105 font-medium"
                  >
                    <SpotifyLogo size={24} weight="fill" />
                    <span className="hidden sm:inline">Spotify</span>
                  </a>
                )}
                {artist.instagramUrl && (
                  <a 
                    href={artist.instagramUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                    title="Instagram"
                  >
                    <InstagramLogo size={24} weight="fill" />
                  </a>
                )}
                {artist.youtubeUrl && (
                  <a 
                    href={artist.youtubeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                    title="YouTube"
                  >
                    <YoutubeLogo size={24} weight="fill" />
                  </a>
                )}
                {artist.facebookUrl && (
                  <a
                    href={artist.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                    title="Facebook"
                  >
                    <FacebookLogo size={24} weight="fill" />
                  </a>
                )}
                {artist.twitterUrl && (
                  <a
                    href={artist.twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                    title="X / Twitter"
                  >
                    <TwitterLogo size={24} weight="fill" />
                  </a>
                )}
                {artist.tiktokUrl && (
                  <a
                    href={artist.tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                    title="TikTok"
                  >
                    <TiktokLogo size={24} weight="fill" />
                  </a>
                )}
                {artist.bandcampUrl && (
                  <a
                    href={artist.bandcampUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                    title="Bandcamp"
                  >
                    <MusicNote size={24} weight="fill" />
                  </a>
                )}
                {artist.websiteUrl && (
                  <a 
                    href={artist.websiteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-105"
                    title="Website"
                  >
                    <Globe size={24} weight="fill" />
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
