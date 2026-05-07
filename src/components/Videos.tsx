import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Play } from '@phosphor-icons/react'
import type { Video } from '@/types'

interface VideosProps {
  videos: Video[]
}

export function Videos({ videos }: VideosProps) {
  return (
    <section id="videos" className="py-24 lg:py-32 bg-card/30">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4">Music Videos</h2>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Experience the visual side of alternative music.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Card className="group bg-card border-border overflow-hidden hover:border-secondary transition-all duration-300 cursor-pointer">
                <div className="relative aspect-video overflow-hidden">
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={32} weight="fill" className="text-accent-foreground ml-1" />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold mb-1 line-clamp-2">{video.title}</h3>
                  <p className="text-sm text-muted-foreground">{video.artistName}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(video.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
