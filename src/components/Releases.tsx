'use client'

import { useState, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { ReleasesCarousel } from '@/components/ReleasesCarousel'
import { Releases3DCarousel } from '@/components/Releases3DCarousel'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface ReleasesProps extends SectionProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
}

export function Releases({ releases, dict, locale }: ReleasesProps) {
  const prefersReducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  // Category / type filter
  const allTypes: string[] = []
  releases.forEach((r) => {
    if (r.type && !allTypes.includes(r.type)) allTypes.push(r.type)
  })
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = releases
    .filter((r) => !selectedType || r.type === selectedType)
    .filter((r) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return r.title.toLowerCase().includes(q) || r.artistName.toLowerCase().includes(q)
    })

  const handleTypeChange = (type: string | null) => {
    setSelectedType(type)
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

        {/* Search + category filter row */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          {/* Search input */}
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlass
              size={16}
              weight="bold"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={dict.searchPlaceholder}
              aria-label={dict.searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 text-sm font-mono bg-card border border-border rounded-full focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40 transition-colors placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Type filter tabs */}
          {allTypes.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTypeChange(null)}
                className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-all ${
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
                  onClick={() => handleTypeChange(type)}
                  className={`px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-full border transition-all ${
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
        </motion.div>

        {filtered.length === 0 ? (
          <p className="text-muted-foreground font-mono text-sm py-12 text-center">
            {dict.noResults}
          </p>
        ) : (
          <>
            {/* Mobile: swipe gallery (one card at a time) */}
            <div className="block md:hidden">
              <ReleasesCarousel releases={filtered} dict={dict} locale={locale} />
            </div>

            {/* Desktop: real 3D coverflow carousel */}
            <div className="hidden md:block">
              <Releases3DCarousel releases={filtered} dict={dict} locale={locale} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
