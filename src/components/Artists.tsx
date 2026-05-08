import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InstagramLogo, SpotifyLogo, YoutubeLogo, Globe } from '@phosphor-icons/react'
import { ArtistModal } from '@/components/ArtistModal'
import type { Artist } from '@/types'

interface ArtistsProps {
  artists: Artist[]
}

export function Artists({ artists }: ArtistsProps) {
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleArtistClick = (artist: Artist) => {
    setSelectedArtist(artist)
    setModalOpen(true)
  }

  return (
    <>
      <section id="artists" className="py-24 px-4 lg:px-16 bg-card/20">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">ARTISTS</h2>
          <p className="text-xl text-muted-foreground font-serif">The creative force behind our sound</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {artists.map((artist, index) => (
            <motion.div 
              key={artist.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card 
                className="glow-card group bg-card border-border overflow-hidden hover:border-primary/50 transition-all duration-300 h-full cursor-pointer"
                onClick={() => handleArtistClick(artist)}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img 
                    src={artist.imageUrl} 
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
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
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {artist.spotifyUrl && (
                      <a 
                        href={artist.spotifyUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <SpotifyLogo size={20} weight="fill" />
                      </a>
                    )}
                    {artist.instagramUrl && (
                      <a 
                        href={artist.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <InstagramLogo size={20} weight="fill" />
                      </a>
                    )}
                    {artist.youtubeUrl && (
                      <a 
                        href={artist.youtubeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <YoutubeLogo size={20} weight="fill" />
                      </a>
                    )}
                    {artist.websiteUrl && (
                      <a 
                        href={artist.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-all hover:scale-110"
                      >
                        <Globe size={20} weight="fill" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <ArtistModal 
      artist={selectedArtist} 
      open={modalOpen} 
      onOpenChange={setModalOpen} 
    />
    </>
  )
}
