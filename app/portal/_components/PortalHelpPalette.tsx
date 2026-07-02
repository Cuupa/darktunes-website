'use client'

import { useTranslations, useLocale } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import {
  GLOSSARY_ENTRIES,
  HELP_CATEGORIES,
  findHelpCategoryForTopic,
  type HelpCategory,
  type HelpTopic,
} from '@/lib/portal/helpManifest'
import { searchHelpContent } from '@/lib/portal/useHelpSearch'
import { searchPortalFaq } from '@/lib/portal/faqSearch'
import { resolveFaqLocaleField } from '@/lib/portal/faqLocale'
import type { PortalFaqTree } from '@/types'

type PaletteTopicItem = {
  topic: HelpTopic
  category: HelpCategory
  sectionId?: string
}

export const PORTAL_OPEN_HELP_PALETTE_EVENT = 'portal-open-help-palette'

function buildHelpHref(
  basePath: string,
  artistId: string | null,
  topicId: string,
  sectionId?: string,
): string {
  const params = new URLSearchParams()
  if (artistId) params.set('artistId', artistId)
  params.set('topic', topicId)
  if (sectionId) params.set('section', sectionId)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

function buildFaqHref(basePath: string, artistId: string | null, faqSlug: string): string {
  const params = new URLSearchParams()
  if (artistId) params.set('artistId', artistId)
  params.set('faq', faqSlug)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

const EDITOR_ROUTES_WITH_OWN_PALETTE = ['/portal/epk-builder', '/portal/fan-page']

interface PortalHelpPaletteProps {
  faqTree: PortalFaqTree[]
}

export function PortalHelpPalette({ faqTree }: PortalHelpPaletteProps) {
  const t = useTranslations('portalHelp')
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const artistId = searchParams.get('artistId')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const translate = useCallback((key: string) => t(key as Parameters<typeof t>[0]), [t])

  const editorHasOwnPalette = EDITOR_ROUTES_WITH_OWN_PALETTE.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editorHasOwnPalette) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpenEvent = () => setOpen(true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(PORTAL_OPEN_HELP_PALETTE_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(PORTAL_OPEN_HELP_PALETTE_EVENT, onOpenEvent)
    }
  }, [editorHasOwnPalette])

  const searchResult = useMemo(
    () => searchHelpContent(query, translate),
    [query, translate],
  )

  const faqMatches = useMemo(
    () => searchPortalFaq(faqTree, query, locale),
    [faqTree, query, locale],
  )

  const navigateToHelp = (topicId: string, sectionId?: string) => {
    setOpen(false)
    setQuery('')
    router.push(buildHelpHref('/portal/help', artistId, topicId, sectionId))
  }

  const navigateToFaq = (faqSlug: string) => {
    setOpen(false)
    setQuery('')
    router.push(buildFaqHref('/portal/help', artistId, faqSlug))
  }

  const navigateToGlossary = (glossaryId: string) => {
    setOpen(false)
    setQuery('')
    router.push(buildHelpHref('/portal/help', artistId, `glossary-${glossaryId}`))
  }

  const glossaryMatches = searchResult.matches.filter((m) => m.kind === 'glossary')

  const paletteTopics = useMemo((): PaletteTopicItem[] => {
    if (!query.trim()) {
      return HELP_CATEGORIES.flatMap((category) =>
        category.topics.map((topic) => ({ topic, category })),
      )
    }
    const seen = new Set<string>()
    const items: PaletteTopicItem[] = []
    for (const match of searchResult.matches) {
      if (match.kind !== 'topic' && match.kind !== 'section') continue
      if (!match.topicId) continue
      const key = `${match.topicId}:${match.sectionId ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      const category = findHelpCategoryForTopic(match.topicId)
      const topic = category?.topics.find((tp) => tp.id === match.topicId)
      if (!topic || !category) continue
      items.push({ topic, category, sectionId: match.sectionId })
    }
    return items
  }, [query, searchResult.matches])

  const paletteFaqItems = useMemo(() => {
    if (!query.trim()) {
      return faqTree.flatMap((group) =>
        group.items.map((item) => ({
          item,
          categoryTitle: resolveFaqLocaleField(locale, group.category.titleEn, group.category.titleDe),
        })),
      )
    }
    const slugSet = new Set(faqMatches.map((m) => m.itemSlug))
    return faqTree.flatMap((group) =>
      group.items
        .filter((item) => slugSet.has(item.slug))
        .map((item) => ({
          item,
          categoryTitle: resolveFaqLocaleField(locale, group.category.titleEn, group.category.titleDe),
        })),
    )
  }, [faqTree, faqMatches, locale, query])

  const showAllGlossary = !query.trim()

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t('palette_title')}
      description={t('palette_description')}
    >
      <CommandInput
        placeholder={t('search_placeholder')}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{t('search_no_results')}</CommandEmpty>

        {paletteFaqItems.length > 0 && (
          <CommandGroup heading={t('palette_group_faq')}>
            {paletteFaqItems.map(({ item, categoryTitle }) => {
              const question = resolveFaqLocaleField(locale, item.questionEn, item.questionDe)
              return (
                <CommandItem
                  key={item.id}
                  value={`${categoryTitle} ${question}`}
                  onSelect={() => navigateToFaq(item.slug)}
                >
                  <span className="flex flex-col gap-0.5">
                    <span>{question}</span>
                    <span className="text-xs text-muted-foreground">{categoryTitle}</span>
                  </span>
                  <CommandShortcut>FAQ</CommandShortcut>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        <CommandGroup heading={t('palette_group_topics')}>
          {paletteTopics.map(({ topic, category, sectionId }) => {
            const section = sectionId
              ? topic.sections.find((s) => s.id === sectionId)
              : undefined
            return (
              <CommandItem
                key={`${topic.id}-${sectionId ?? 'topic'}`}
                value={`${translate(category.titleKey)} ${translate(topic.titleKey)} ${section ? translate(section.titleKey) : ''}`}
                onSelect={() => navigateToHelp(topic.id, sectionId)}
              >
                <span className="flex flex-col gap-0.5">
                  <span>{translate(topic.titleKey)}</span>
                  {section && (
                    <span className="text-xs text-muted-foreground">{translate(section.titleKey)}</span>
                  )}
                </span>
                <CommandShortcut>{category.id}</CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandGroup heading={t('palette_group_glossary')}>
          {(showAllGlossary
            ? GLOSSARY_ENTRIES
            : glossaryMatches
                .map((m) => GLOSSARY_ENTRIES.find((g) => g.id === m.glossaryId))
                .filter((g): g is (typeof GLOSSARY_ENTRIES)[number] => !!g)
          ).map((entry) => (
            <CommandItem
              key={entry.id}
              value={translate(entry.termKey)}
              onSelect={() => navigateToGlossary(entry.id)}
            >
              {translate(entry.termKey)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}