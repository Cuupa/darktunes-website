'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@phosphor-icons/react'
import { getOptimizedImageUrl } from '@/lib/imageUtils'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'

interface ReleasesProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
}

export function Releases({ releases, dict, locale }: ReleasesProps) {
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US'
  return (
    <section id="releases" className="py-24 px-4 lg:px-16">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight">{dict.heading}</h2>
          <p className="text-xl text-muted-foreground font-serif">{dict.subheading}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {releases.map((release, index) => (
            <motion.div
              key={release.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <Link href={`/releases/${release.id}`} aria-label={`${release.title} – ${release.artistName}`}>
                <Card className="glow-card group bg-card border-border overflow-hidden hover:border-accent/50 transition-all duration-300 cursor-pointer">
                  <div className="relative aspect-square overflow-hidden">
                    {/* layoutId enables the Shared Layout Animation to the detail page */}
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
                      <Calendar size={16} weight="bold" />
                      {new Date(release.releaseDate).toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
