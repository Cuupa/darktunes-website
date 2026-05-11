'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Play } from '@phosphor-icons/react'
import { VideoModal } from '@/components/VideoModal'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Video } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface VideosProps extends SectionProps {
  videos: Video[]
  /** Optional R2 placeholder image URL for the ConsentGate in VideoModal. */
  placeholderUrl?: string
  dict: Dictionary['videos']
  consentDict: Dictionary['consent']
  locale: Locale
}

export function Videos({ videos, placeholderUrl, dict, consentDict, locale }: VideosProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const handleVideoClick = (video: Video) => {
    setSelectedVideo(video)
    setModalOpen(true)
  }

  return (
    <>
      <section id="videos" className="py-24 px-4 lg:px-16 scroll-mt-36">
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

          <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 list-none">
            {videos.map((video, index) => (
              <motion.li
                key={video.id}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : index * 0.1 }}
              >
                <Card className="glow-card group overflow-hidden bg-card border-border hover:border-accent/50 transition-all duration-300 cursor-pointer">
                  <div 
                    className="relative aspect-video overflow-hidden"
                    onClick={() => handleVideoClick(video)}
                  >
                    <img
                      src={getOptimizedImageUrl(video.thumbnailUrl ?? '', 600)}
                      alt={`${video.title} – video thumbnail`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                      <Button
                        size="lg"
                        aria-label={`Play ${video.title}`}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full w-16 h-16 p-0 hover:scale-110 transition-transform"
                      >
                        <Play size={28} weight="fill" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-6">
                    <Badge className="mb-3 bg-primary/20 text-primary-foreground border-primary/30 uppercase tracking-wider font-mono text-xs">
                      {video.artistName}
                    </Badge>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors">
                      {video.title}
                    </h3>
                    <p className="text-sm text-muted-foreground font-mono">
                      {new Date(video.publishedAt).toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </Card>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <VideoModal 
        video={selectedVideo} 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        placeholderUrl={placeholderUrl}
        youtubeLabel={consentDict.loadYouTube}
      />
    </>
  )
}
