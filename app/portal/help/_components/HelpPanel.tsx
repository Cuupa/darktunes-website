'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CaretDown, CaretUp, MagnifyingGlass, X } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  HELP_CATEGORIES,
  HELP_SECTION_TYPE_LABEL_KEYS,
  type HelpSection,
  type HelpSectionType,
  type HelpTopic,
} from '@/lib/portal/helpManifest'
import {
  filterCategoriesBySearch,
  filterGlossaryBySearch,
  getTotalMatchCount,
  searchHelpContent,
} from '@/lib/portal/useHelpSearch'
import { countPortalFaqMatches, searchPortalFaq } from '@/lib/portal/faqSearch'
import { PortalFaqSection } from './PortalFaqSection'
import type { PortalFaqTree } from '@/types'

function SectionTypeBadge({ label }: { type: HelpSectionType; label: string }) {
  return (
    <Badge variant="outline" className="shrink-0 text-[10px] font-normal uppercase tracking-wide">
      {label}
    </Badge>
  )
}

function HelpSectionAccordion({
  section,
  typeLabel,
  title,
  body,
  defaultOpen,
}: {
  section: HelpSection
  typeLabel: string
  title: string
  body: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])

  return (
    <div
      id={`help-section-${section.id}`}
      className="rounded-md border border-border/60 bg-muted/20 overflow-hidden"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <SectionTypeBadge type={section.type} label={typeLabel} />
          <span className="font-medium truncate">{title}</span>
        </span>
        {open ? (
          <CaretUp size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        ) : (
          <CaretDown size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-border/40">
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
      )}
    </div>
  )
}

function TopicAccordion({
  topic,
  title,
  sections,
  sectionLabels,
  getSectionTitle,
  getSectionBody,
  forceOpen,
}: {
  topic: HelpTopic
  title: string
  sections: HelpSection[]
  sectionLabels: Record<HelpSectionType, string>
  getSectionTitle: (section: HelpSection) => string
  getSectionBody: (section: HelpSection) => string
  forceOpen?: boolean
}) {
  const [open, setOpen] = useState(forceOpen ?? false)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  return (
    <div
      id={`help-topic-${topic.id}`}
      className="rounded-lg border border-border bg-card overflow-hidden scroll-mt-24"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>{title}</span>
          {topic.route && (
            <span className="text-xs font-normal text-muted-foreground">{topic.route}</span>
          )}
        </span>
        {open ? (
          <CaretUp size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        ) : (
          <CaretDown size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-4 border-t border-border">
          {sections.map((section) => (
            <HelpSectionAccordion
              key={section.id}
              section={section}
              typeLabel={sectionLabels[section.type]}
              title={getSectionTitle(section)}
              body={getSectionBody(section)}
              defaultOpen={forceOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface HelpPanelProps {
  faqTree: PortalFaqTree[]
}

export function HelpPanel({ faqTree }: HelpPanelProps) {
  const t = useTranslations('portalHelp')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const topicParam = searchParams.get('topic')
  const sectionParam = searchParams.get('section')
  const faqParam = searchParams.get('faq')
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const translate = useCallback((key: string) => t(key as Parameters<typeof t>[0]), [t])

  const sectionLabels = useMemo(
    () =>
      Object.fromEntries(
        (Object.entries(HELP_SECTION_TYPE_LABEL_KEYS) as [HelpSectionType, string][]).map(
          ([type, key]) => [type, translate(key)],
        ),
      ) as Record<HelpSectionType, string>,
    [translate],
  )

  const filteredCategories = useMemo(
    () => filterCategoriesBySearch(HELP_CATEGORIES, query, translate),
    [query, translate],
  )

  const filteredGlossary = useMemo(
    () => filterGlossaryBySearch(query, translate),
    [query, translate],
  )

  const searchResult = useMemo(
    () => searchHelpContent(query, translate),
    [query, translate],
  )

  const faqMatches = useMemo(
    () => searchPortalFaq(faqTree, query, locale),
    [faqTree, query, locale],
  )

  const hasQuery = query.trim().length > 0
  const totalMatches = getTotalMatchCount(searchResult) + countPortalFaqMatches(faqMatches)

  useEffect(() => {
    if (faqParam) return
    if (!topicParam) return
    const targetId = topicParam.startsWith('glossary-')
      ? `help-glossary-${topicParam.slice('glossary-'.length)}`
      : sectionParam
        ? `help-section-${sectionParam}`
        : `help-topic-${topicParam}`
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [topicParam, sectionParam, faqParam])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl leading-relaxed">{t('intro')}</p>
      </div>

      <div
        role="search"
        className="sticky top-0 z-10 -mx-1 rounded-lg border border-border bg-card/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      >
        <label htmlFor="portal-help-search" className="sr-only">
          {t('search_placeholder')}
        </label>
        <div className="relative">
          <MagnifyingGlass
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            id="portal-help-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="pl-10 pr-10"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="absolute right-1 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label={t('search_clear')}
              onClick={() => {
                setQuery('')
                searchRef.current?.focus()
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {hasQuery && (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {totalMatches > 0
              ? t('search_results_count', { count: totalMatches })
              : t('search_no_results')}
          </p>
        )}
      </div>

      <PortalFaqSection tree={faqTree} searchQuery={query} highlightSlug={faqParam} />

      {filteredCategories.map((category) => (
        <section key={category.id} aria-labelledby={`help-cat-${category.id}`}>
          <h2
            id={`help-cat-${category.id}`}
            className="mb-3 text-lg font-semibold tracking-tight"
          >
            {translate(category.titleKey)}
          </h2>
          <div className="space-y-3">
            {category.topics.map((topic) => (
              <TopicAccordion
                key={topic.id}
                topic={topic}
                title={translate(topic.titleKey)}
                sections={topic.sections}
                sectionLabels={sectionLabels}
                getSectionTitle={(s) => translate(s.titleKey)}
                getSectionBody={(s) => translate(s.bodyKey)}
                forceOpen={hasQuery || topicParam === topic.id}
              />
            ))}
          </div>
        </section>
      ))}

      {hasQuery && filteredCategories.length === 0 && faqMatches.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('search_no_results')}</p>
      )}

      <section aria-labelledby="help-glossary-heading" className="scroll-mt-24">
        <h2 id="help-glossary-heading" className="text-lg font-semibold tracking-tight">
          {t('glossary_heading')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{t('glossary_intro')}</p>
        <dl className="space-y-3">
          {filteredGlossary.map((entry) => (
            <div
              key={entry.id}
              id={`help-glossary-${entry.id}`}
              className={cn(
                'rounded-lg border border-border bg-card px-4 py-3',
                topicParam === `glossary-${entry.id}` && 'ring-2 ring-primary/40',
              )}
            >
              <dt className="font-semibold">{translate(entry.termKey)}</dt>
              <dd className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {translate(entry.definitionKey)}
              </dd>
            </div>
          ))}
        </dl>
        {hasQuery && filteredGlossary.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('search_no_results')}</p>
        )}
      </section>
    </div>
  )
}