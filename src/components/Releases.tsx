'use client'

import { useState, useRef, useMemo, useDeferredValue } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { ReleasesCoverflow } from '@/components/ReleasesCoverflow'
import type { Release } from '@/types'
import type { Dictionary, Locale } from '@/i18n/types'
import type { SectionProps } from '@/lib/component-contracts'

interface ReleasesProps extends SectionProps {
  releases: Release[]
  dict: Dictionary['releases']
  locale: Locale
  autoplayMs?: number
  consentDict: Dictionary['consent']
}

export function Releases({ releases, dict, locale, autoplayMs, consentDict }: ReleasesProps) {
  const prefersReducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Defer expensive filtering so the search input stays responsive on every
  // keystroke.  The deferred values lag one React render behind the real state,
  // keeping input latency near zero while the filter computation runs as an
  // interruptible low-priority update.
  const deferredSearch = useDeferredValue(searchQuery)
  const deferredType = useDeferredValue(selectedType)

  /** True while React is still processing the deferred filter update. */
  const isFilterPending = deferredSearch !== searchQuery || deferredType !== selectedType

  const allTypes = useMemo(() => {
    const types: string[] = []
    releases.forEach((r) => {
      if (r.type && !types.includes(r.type)) types.push(r.type)
    })
    return types
  }, [releases])

  const filtered = useMemo(
    () =>
      releases
        .filter((r) => !deferredType || r.type === deferredType)
        .filter((r) => {
          if (!deferredSearch.trim()) return true
          const q = deferredSearch.toLowerCase()
          return r.title.toLowerCase().includes(q) || r.artistName.toLowerCase().includes(q)
        }),
    [releases, deferredSearch, deferredType],
  )

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

        {/* Subtle opacity fade while the deferred filter is still pending */}
        <div className={`transition-opacity duration-150 ${isFilterPending ? 'opacity-60' : 'opacity-100'}`}>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground font-mono text-sm py-12 text-center">
              {dict.noResults}
            </p>
          ) : (
            <ReleasesCoverflow releases={filtered} dict={dict} locale={locale} autoplayMs={autoplayMs} consentDict={consentDict} />
          )}
        </div>
      </div>
    </section>
  )
}
