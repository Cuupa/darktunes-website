'use client'
/**
 * ArtistsGridContent — Client component rendering the artist photo grid.
 *
 * On mobile: photo is always visible with artist name overlay.
 * On desktop: shows photo, hovers reveals the band logo (if set) or name.
 * Clicking any card navigates to /artists/[slug].
 */

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { getSquareThumbnail, getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Artist } from '@/types'

interface ArtistsGridContentProps {
  artists: Artist[]
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function ArtistsGridContent({ artists }: ArtistsGridContentProps) {
  const prefersReducedMotion = useReducedMotion()

  if (artists.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-24 text-lg">
        No artists found.
      </p>
    )
  }

  return (
    <motion.ul
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 list-none"
      variants={prefersReducedMotion ? {} : containerVariants}
      initial="hidden"
      animate="visible"
    >
      {artists.map((artist) => (
        <motion.li key={artist.id} variants={prefersReducedMotion ? {} : itemVariants}>
          <Link
            href={`/artists/${artist.slug}`}
            className="group relative block overflow-hidden rounded-lg aspect-square bg-card border border-border hover:border-accent/50 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={artist.name}
          >
            {/* Artist photo */}
            {artist.imageUrl ? (
              <img
                src={getSquareThumbnail(artist.imageUrl, 400)}
                alt={`${artist.name} – artist photo`}
                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-card to-background flex items-center justify-center">
                <span className="text-6xl font-bold text-muted-foreground/30 uppercase select-none">
                  {artist.name.slice(0, 2)}
                </span>
              </div>
            )}

            {/* Default overlay: darkened gradient + name at bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:opacity-0 transition-opacity duration-300" />
            <div className="absolute bottom-0 left-0 right-0 p-3 group-hover:opacity-0 transition-opacity duration-300">
              <p className="text-white font-bold text-sm leading-tight truncate drop-shadow-lg">
                {artist.name}
              </p>
            </div>

            {/* Hover overlay: show logo or large name */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4">
              {artist.logoUrl ? (
                <img
                  src={getOptimizedImageUrl(artist.logoUrl, 300)}
                  alt={`${artist.name} – logo`}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <p className="text-white font-bold text-lg text-center leading-tight">
                  {artist.name}
                </p>
              )}
            </div>
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  )
}
