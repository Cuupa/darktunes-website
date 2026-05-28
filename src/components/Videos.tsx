'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Play, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
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
  /** Number of videos per page (default: 9). */
  videosPerPage?: number
  /** When true, show only the first page and add a "View all" link to /videos. */
  videosLinkToPage?: boolean
}

// Batched stagger animation — single IntersectionObserver + shared scheduler
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

/** Individual video card with skeleton loading state for the thumbnail. */
function VideoCard({
  video,
  dateLocale,
  onPlay,
}: {
  video: Video
  dateLocale: string
  onPlay: (video: Video) => void
}) {
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <Card
      className="glow-card group overflow-hidden bg-card border-border hover:border-accent/50 transition-all duration-300 cursor-pointer flex flex-col w-full"
      onClick={() => onPlay(video)}
    >
      <div className="relative aspect-video overflow-hidden shrink-0">
        {/* Skeleton shown until the thumbnail image has loaded */}
        {!imgLoaded && (
          <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
        )}
        <img
          src={getOptimizedImageUrl(video.thumbnailUrl ?? '', 600)}
          alt={`${video.title} – video thumbnail`}
          className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          sizes="(max-width: 768px) 82vw, (max-width: 1024px) 50vw, 33vw"
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoaded(true)}
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors flex items-center justify-center">
          <Button
            size="lg"
            aria-label={`Play ${video.title}`}
            className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full w-16 h-16 p-0 hover:scale-110 transition-transform"
            tabIndex={-1}
          >
            <Play size={28} weight="fill" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="p-6 flex flex-col flex-1">
        <Badge className="mb-3 bg-primary/20 text-primary-foreground border-primary/30 uppercase tracking-wider font-mono text-xs self-start">
          {video.artistName}
        </Badge>
        <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors flex-1">
          {video.title}
        </h3>
        <p className="text-sm text-muted-foreground font-mono mt-auto">
          {new Date(video.publishedAt).toLocaleDateString(dateLocale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>
    </Card>
  )
}

export function Videos({ videos, placeholderUrl, dict, consentDict, locale, videosPerPage = 9, videosLinkToPage = false }: VideosProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const prefersReducedMotion = useReducedMotion()

  const perPage = Math.max(1, videosPerPage)
  const totalPages = Math.ceil(videos.length / perPage)
  // When videosLinkToPage is true, only show the first page
  const effectiveTotalPages = videosLinkToPage ? 1 : totalPages
  const currentPage = Math.min(page, effectiveTotalPages)
  const pageVideos = videos.slice((currentPage - 1) * perPage, currentPage * perPage)

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

          {videos.length === 0 && (
            <p className="text-center text-muted-foreground font-mono py-12">
              {dict.noVideos}
            </p>
          )}

          {/* data-lenis-prevent removed: vertical Lenis scroll is not affected by the grid layout */}
          <motion.ul
            className="list-none flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-4 md:grid md:grid-cols-2 md:items-stretch md:overflow-x-visible md:gap-8 md:pb-0 lg:grid-cols-3"
            variants={prefersReducedMotion ? undefined : listVariants}
            initial={prefersReducedMotion ? { opacity: 1 } : 'hidden'}
            whileInView={prefersReducedMotion ? { opacity: 1 } : 'visible'}
            viewport={{ once: true }}
          >
            {pageVideos.map((video) => (
              <motion.li
                key={video.id}
                className="flex-none w-[82vw] snap-start md:w-auto flex"
                variants={prefersReducedMotion ? undefined : itemVariants}
              >
                <VideoCard video={video} dateLocale={dateLocale} onPlay={handleVideoClick} />
              </motion.li>
            ))}
          </motion.ul>

          {/* Pagination controls */}
          {(effectiveTotalPages > 1 || videosLinkToPage) && (
            <div className="flex items-center justify-center gap-4 mt-12">
              {effectiveTotalPages > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    aria-label="Previous page"
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </Button>
                  <span className="text-sm text-muted-foreground font-mono">
                    {currentPage} / {effectiveTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(effectiveTotalPages, p + 1))}
                    disabled={currentPage >= effectiveTotalPages}
                    aria-label="Next page"
                  >
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                </>
              )}
              {videosLinkToPage && videos.length > perPage && (
                <Button asChild variant="outline" size="lg" className="min-w-[160px]">
                  <Link href="/videos">{dict.viewAll ?? 'View all videos'}</Link>
                </Button>
              )}
            </div>
          )}
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
