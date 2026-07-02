'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { CaretDown, CaretUp, ArrowSquareOut } from '@phosphor-icons/react'
import { RichFaqContent } from '@/components/portal/RichFaqContent'
import { resolveFaqLocaleField } from '@/lib/portal/faqLocale'
import { filterPortalFaqBySearch } from '@/lib/portal/faqSearch'
import type { PortalFaqItem, PortalFaqTree } from '@/types'

interface PortalFaqSectionProps {
  tree: PortalFaqTree[]
  searchQuery: string
  highlightSlug?: string | null
}

function FaqItemAccordion({
  item,
  question,
  answer,
  forceOpen,
}: {
  item: PortalFaqItem
  question: string
  answer: string
  forceOpen?: boolean
}) {
  const t = useTranslations('portalHelp')
  const [open, setOpen] = useState(forceOpen ?? false)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  return (
    <div
      id={`portal-faq-${item.slug}`}
      className="rounded-md border border-border/60 bg-muted/20 overflow-hidden scroll-mt-24"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm min-h-[44px]"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium">{question}</span>
        {open ? (
          <CaretUp size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        ) : (
          <CaretDown size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-border/40 space-y-3">
          <RichFaqContent content={answer} />
          {item.portalRoute && (
            <Link
              href={item.portalRoute}
              className="inline-flex items-center gap-1.5 text-sm text-accent underline underline-offset-2 hover:opacity-80"
            >
              <ArrowSquareOut size={14} aria-hidden="true" />
              {t('faq_open_portal_page')}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export function PortalFaqSection({ tree, searchQuery, highlightSlug }: PortalFaqSectionProps) {
  const t = useTranslations('portalHelp')
  const locale = useLocale()

  const filteredTree = useMemo(
    () => filterPortalFaqBySearch(tree, searchQuery, locale),
    [tree, searchQuery, locale],
  )

  useEffect(() => {
    if (!highlightSlug) return
    document.getElementById(`portal-faq-${highlightSlug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [highlightSlug])

  if (tree.length === 0) {
    return null
  }

  const hasQuery = searchQuery.trim().length > 0

  return (
    <section aria-labelledby="portal-faq-heading" className="scroll-mt-24">
      <h2 id="portal-faq-heading" className="text-xl font-semibold tracking-tight">
        {t('faq_heading')}
      </h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-3xl leading-relaxed">
        {t('faq_intro')}
      </p>

      {filteredTree.length === 0 && hasQuery ? (
        <p className="text-sm text-muted-foreground">{t('faq_no_results')}</p>
      ) : (
        <div className="space-y-6">
          {filteredTree.map((group) => {
            const categoryTitle = resolveFaqLocaleField(
              locale,
              group.category.titleEn,
              group.category.titleDe,
            )
            return (
              <div key={group.category.id}>
                <h3 className="mb-3 text-base font-semibold text-foreground/90">{categoryTitle}</h3>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const question = resolveFaqLocaleField(locale, item.questionEn, item.questionDe)
                    const answer = resolveFaqLocaleField(locale, item.answerHtmlEn, item.answerHtmlDe)
                    return (
                      <FaqItemAccordion
                        key={item.id}
                        item={item}
                        question={question}
                        answer={answer}
                        forceOpen={hasQuery || highlightSlug === item.slug}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}