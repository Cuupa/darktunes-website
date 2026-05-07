import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InstagramLogo, SpotifyLogo, YoutubeLogo, Globe } from '@phosphor-icons/react'
import type { Artist } from '@/types'

interface ArtistsProps {
  artists: Artist[]
}

export function Artists({ artists }: ArtistsProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 }
  }

  return (
    <section id="artists" className="py-24 lg:py-32 bg-card/30">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4">Our Artists</h2>
          <p className="text-xl text-muted-foreground max-w-2xl">
            The creative powerhouse behind the darkTunes sound.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {artists.map((artist) => (
            <motion.div key={artist.id} variants={itemVariants}>
              <Card className="group bg-card border-border overflow-hidden hover:border-primary transition-all duration-300 h-full">
                <div className="relative aspect-square overflow-hidden">
                  <img 
                    src={artist.imageUrl} 
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-3xl font-bold mb-2">{artist.name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {artist.genres.map((genre) => (
                        <Badge key={genre} variant="secondary" className="text-xs">
                          {genre}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {artist.bio}
                  </p>
                  <div className="flex gap-2">
                    {artist.spotifyUrl && (
                      <a 
                        href={artist.spotifyUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <SpotifyLogo size={20} weight="fill" />
                      </a>
                    )}
                    {artist.instagramUrl && (
                      <a 
                        href={artist.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <InstagramLogo size={20} weight="fill" />
                      </a>
                    )}
                    {artist.youtubeUrl && (
                      <a 
                        href={artist.youtubeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <YoutubeLogo size={20} weight="fill" />
                      </a>
                    )}
                    {artist.websiteUrl && (
                      <a 
                        href={artist.websiteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        <Globe size={20} weight="fill" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
