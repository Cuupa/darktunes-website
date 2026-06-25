'use client'

import { useState, useMemo, useDeferredValue } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { getSquareThumbnail } from '@/lib/imageUtils'
import { useTranslations } from 'next-intl'
import type { Release } from '@/types'

interface ReleasesPageContentProps {
  releases: Release[]
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function ReleasesPageContent({ releases }: ReleasesPageContentProps) {
  const t = useTranslations('releases')
  const prefersReducedMotion = useReducedMotion()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(searchQuery)
  const deferredType = useDeferredValue(selectedType)

  const allTypes = useMemo(() => {
    const types: string[] = []
    releases.forEach((r) => {
      if (r.type && !types.includes(r.type)) types.push(r.type)
    })
    return types
  }, [releases])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return releases
      .filter((r) => !deferredType || r.type === deferredType)
      .filter((r) => {
        if (!q) return true
        return r.title.toLowerCase().includes(q) || r.artistName.toLowerCase().includes(q)
      })
  }, [releases, deferredQuery, deferredType])

  const isPending = deferredQuery !== searchQuery || deferredType !== selectedType

  return (
    <>
      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="h-11 w-full rounded-md border border-border bg-muted pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {allTypes.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter releases by type">
            <button
              onClick={() => setSelectedType(null)}
              aria-pressed={selectedType === null}
              className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                selectedType === null
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-transparent border-border text-muted-foreground hover:border-accent/50 hover:text-foreground'
              }`}
            >
              All
            </button>
            {allTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                aria-pressed={selectedType === type}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  selectedType === type
                    ? 'bg-accent text-accent-foreground border-accent'
                    : 'bg-transparent border-border text-muted-foreground hover:border-accent/50 hover:text-foreground'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={`transition-opacity duration-150 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-24 text-lg">{t('noResults')}</p>
        ) : (
          <motion.ul
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 list-none"
            variants={prefersReducedMotion ? {} : containerVariants}
            initial="hidden"
            animate="visible"
          >
            {filtered.map((release) => (
              <motion.li key={release.id} variants={prefersReducedMotion ? {} : itemVariants}>
                <Link
                  href={`/releases/${release.id}`}
                  className="group relative block overflow-hidden rounded-lg bg-card border border-border hover:border-accent/50 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`${release.title} by ${release.artistName}`}
                >
                  <div className="relative aspect-square overflow-hidden">
                    {release.coverArt ? (
                      <Image
                        src={getSquareThumbnail(release.coverArt, 400)}
                        alt={`${release.title} – cover art`}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        unoptimized
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-card to-background flex items-center justify-center">
                        <span className="text-4xl font-bold text-muted-foreground/30 uppercase select-none">
                          {release.title.slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute top-2 right-2 text-[10px] font-mono uppercase tracking-widest bg-black/60 text-white px-2 py-0.5 rounded">
                      {release.type}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-sm leading-tight truncate">{release.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{release.artistName}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">
                      {release.releaseDate?.slice(0, 4)}
                    </p>
                  </div>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </>
  )
}
