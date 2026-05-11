'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  InstagramLogo,
  SpotifyLogo,
  YoutubeLogo,
  Globe,
  FacebookLogo,
  TwitterLogo,
  TiktokLogo,
  MusicNote,
  ShoppingBag,
} from '@phosphor-icons/react'
import { ArtistModal } from '@/components/ArtistModal'
import { getSquareThumbnail } from '@/lib/imageUtils'
import type { Artist } from '@/types'
import type { Dictionary } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface ArtistsProps extends SectionProps {
  artists: Artist[]
  dict: Dictionary['artists']
}

export function Artists({ artists, dict }: ArtistsProps) {
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const handleArtistClick = (artist: Artist) => {
    setSelectedArtist(artist)
    setModalOpen(true)
  }

  return (
    <>
      <section id="artists" className="py-24 px-4 lg:px-16 bg-card/20 scroll-mt-36">
      <div className="container mx-auto">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="mb-12"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">{dict.heading}</h2>
          <p className="text-xl text-muted-foreground font-serif">{dict.subheading}</p>
        </motion.div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 list-none">
          {artists.map((artist, index) => (
            <motion.li
              key={artist.id}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : index * 0.1 }}
            >
              <Card 
                className="glow-card group bg-card border-border overflow-hidden hover:border-primary/50 transition-all duration-300 h-full cursor-pointer"
                onClick={() => handleArtistClick(artist)}
              >
                <div className="relative aspect-square overflow-hidden">
                  {getSquareThumbnail(artist.imageUrl ?? '', 800) ? (
                    <img
                      src={getSquareThumbnail(artist.imageUrl ?? '', 800)}
                      alt={`${artist.name} – artist photo`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null
                        if (placeholder) placeholder.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full bg-gradient-to-br from-card to-background flex items-center justify-center"
                    style={{ display: getSquareThumbnail(artist.imageUrl ?? '', 800) ? 'none' : 'flex' }}
                  >
                    <span className="text-6xl font-bold text-muted-foreground/40 select-none uppercase">
                      {artist.name.slice(0, 2)}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-3xl font-bold mb-3 group-hover:text-accent transition-colors">{artist.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {artist.genres.map((genre) => (
                        <Badge key={genre} className="bg-primary/20 text-primary-foreground border-primary/30 backdrop-blur-sm uppercase font-mono text-xs tracking-wider">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground font-serif line-clamp-3 leading-relaxed">
                    {artist.bio}
                  </p>
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    {artist.spotifyUrl && (
                      <a 
                        href={artist.spotifyUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} on Spotify`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <SpotifyLogo size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.instagramUrl && (
                      <a 
                        href={artist.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} on Instagram`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <InstagramLogo size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.youtubeUrl && (
                      <a 
                        href={artist.youtubeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} on YouTube`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <YoutubeLogo size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.facebookUrl && (
                      <a
                        href={artist.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} on Facebook`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <FacebookLogo size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.twitterUrl && (
                      <a
                        href={artist.twitterUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} on X (Twitter)`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <TwitterLogo size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.tiktokUrl && (
                      <a
                        href={artist.tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} on TikTok`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <TiktokLogo size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.bandcampUrl && (
                      <a
                        href={artist.bandcampUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} on Bandcamp`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <MusicNote size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.shopUrl && (
                      <a
                        href={artist.shopUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} merch shop`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-secondary hover:text-white transition-all hover:scale-110"
                      >
                        <ShoppingBag size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                    {artist.websiteUrl && (
                      <a 
                        href={artist.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        aria-label={`${artist.name} official website`}
                        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <Globe size={20} weight="fill" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>

    <ArtistModal 
      artist={selectedArtist} 
      open={modalOpen} 
      onClose={() => setModalOpen(false)}
    />
    </>
  )
}
