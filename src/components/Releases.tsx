'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import { ContentPagination } from '@/components/ContentPagination'
import { ReleasesCarousel } from '@/components/ReleasesCarousel'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

const ITEMS_PER_PAGE = 6

interface ReleasesProps extends SectionProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
}

export function Releases({ releases, dict, locale }: ReleasesProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  const prefersReducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  // Genre filter
  const allGenres: string[] = []
  releases.forEach((r) => {
    if (r.type && !allGenres.includes(r.type)) allGenres.push(r.type)
  })
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)

  const filtered = selectedGenre
    ? releases.filter((r) => r.type === selectedGenre)
    : releases

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  )

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleGenreChange = (genre: string | null) => {
    setSelectedGenre(genre)
    setCurrentPage(1)
  }

  return (
    <section id="releases" ref={sectionRef} className="py-24 px-4 lg:px-16 scroll-mt-36">
      <div className="container mx-auto">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="mb-10"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">{dict.heading}</h2>
          <p className="text-xl text-muted-foreground font-serif">{dict.subheading}</p>
        </motion.div>

        {/* Genre / type filter tabs */}
        {allGenres.length > 1 && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : 0.1 }}
            className="flex flex-wrap gap-2 mb-8"
          >
            <button
              onClick={() => handleGenreChange(null)}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-all ${
                selectedGenre === null
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-transparent border-border text-muted-foreground hover:border-accent/50 hover:text-foreground'
              }`}
            >
              All
            </button>
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => handleGenreChange(genre)}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-all ${
                  selectedGenre === genre
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-transparent border-border text-muted-foreground hover:border-accent/50 hover:text-foreground'
                }`}
              >
                {genre}
              </button>
            ))}
          </motion.div>
        )}

        {/* Mobile: 3D Carousel */}
        <div className="block md:hidden">
          <ReleasesCarousel releases={filtered} dict={dict} locale={locale} />
        </div>

        {/* Desktop: grid with pagination */}
        <div className="hidden md:block">
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 list-none">
            {paginated.map((release, index) => (
              <motion.li
                key={release.id}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : index * 0.1 }}
              >
                <Link href={`/releases/${release.id}`} aria-label={`${release.title} – ${release.artistName}`}>
                  <Card className="glow-card group bg-card border-border overflow-hidden hover:border-accent/50 transition-all duration-300 cursor-pointer">
                    <div className="relative aspect-square overflow-hidden">
                      <motion.img
                        layoutId={`release-cover-${release.id}`}
                        src={getOptimizedImageUrl(release.coverArt, 600)}
                        alt={`${release.title} cover`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {release.featured && (
                        <Badge className="absolute top-4 right-4 bg-secondary/90 text-secondary-foreground backdrop-blur-sm font-bold uppercase tracking-wider">
                          {dict.featured}
                        </Badge>
                      )}
                    </div>
                    <div className="p-6 space-y-3">
                      <Badge variant="outline" className="uppercase text-xs font-mono tracking-widest border-primary/30 text-primary-foreground">
                        {release.type}
                      </Badge>
                      <h3 className="text-2xl font-bold line-clamp-1 group-hover:text-accent transition-colors">{release.title}</h3>
                      <p className="text-muted-foreground font-medium">{release.artistName}</p>
                      <p className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                        <Calendar size={16} weight="bold" aria-hidden="true" />
                        {new Date(release.releaseDate).toLocaleDateString(dateLocale, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </Card>
                </Link>
              </motion.li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-12">
              <ContentPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
