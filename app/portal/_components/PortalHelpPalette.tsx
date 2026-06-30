'use client'

import { useTranslations } from 'next-intl'
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
} from '@/lib/portal/helpManifest'
import { searchHelpContent } from '@/lib/portal/useHelpSearch'

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

const EDITOR_ROUTES_WITH_OWN_PALETTE = ['/portal/epk-builder', '/portal/fan-page']

export function PortalHelpPalette() {
  const t = useTranslations('portalHelp')
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

  const navigateToHelp = (topicId: string, sectionId?: string) => {
    setOpen(false)
    setQuery('')
    router.push(buildHelpHref('/portal/help', artistId, topicId, sectionId))
  }

  const navigateToGlossary = (glossaryId: string) => {
    setOpen(false)
    setQuery('')
    router.push(buildHelpHref('/portal/help', artistId, `glossary-${glossaryId}`))
  }

  const topicMatches = searchResult.matches.filter((m) => m.kind === 'topic' || m.kind === 'section')
  const glossaryMatches = searchResult.matches.filter((m) => m.kind === 'glossary')

  const showAllTopics = !query.trim()
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

        <CommandGroup heading={t('palette_group_topics')}>
          {(showAllTopics
            ? HELP_CATEGORIES.flatMap((c) =>
                c.topics.map((topic) => ({ topic, category: c })),
              )
            : topicMatches
                .filter((m) => m.topicId)
                .map((m) => {
                  const category = findHelpCategoryForTopic(m.topicId!)
                  const topic = category?.topics.find((tp) => tp.id === m.topicId)
                  return topic && category ? { topic, category, sectionId: m.sectionId } : null
                })
                .filter((x): x is NonNullable<typeof x> => x !== null)
          ).map((item) => {
            const { topic, category } = item
            const sectionId = 'sectionId' in item ? item.sectionId : undefined
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