import {
  GLOSSARY_ENTRIES,
  HELP_CATEGORIES,
  type GlossaryEntry,
  type HelpCategory,
  type HelpSection,
  type HelpTopic,
} from './helpManifest'

export interface HelpSearchMatch {
  kind: 'topic' | 'section' | 'glossary'
  categoryId?: string
  topicId?: string
  sectionId?: string
  glossaryId?: string
  score: number
}

export interface HelpSearchResult {
  query: string
  matches: HelpSearchMatch[]
  topicCount: number
  sectionCount: number
  glossaryCount: number
}

type TranslateFn = (key: string) => string

/** Normalize for case- and umlaut-insensitive matching */
export function normalizeHelpSearchText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

function tokenize(query: string): string[] {
  return normalizeHelpSearchText(query)
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

function scoreText(haystack: string, tokens: string[]): number {
  if (tokens.length === 0) return 1
  const normalized = normalizeHelpSearchText(haystack)
  let score = 0
  for (const token of tokens) {
    if (normalized.includes(token)) score += 1
  }
  return score
}

function sectionSearchBlob(
  section: HelpSection,
  topic: HelpTopic,
  t: TranslateFn,
): string {
  const parts = [
    t(topic.titleKey),
    t(section.titleKey),
    t(section.bodyKey),
    ...(section.keywords ?? []),
  ]
  return parts.join(' ')
}

function topicSearchBlob(topic: HelpTopic, t: TranslateFn): string {
  const sectionText = topic.sections
    .map((s) => sectionSearchBlob(s, topic, t))
    .join(' ')
  return [t(topic.titleKey), topic.route ?? '', sectionText].join(' ')
}

function glossarySearchBlob(entry: GlossaryEntry, t: TranslateFn): string {
  return [t(entry.termKey), t(entry.definitionKey), ...(entry.keywords ?? [])].join(' ')
}

export function searchHelpContent(query: string, t: TranslateFn): HelpSearchResult {
  const tokens = tokenize(query)
  const matches: HelpSearchMatch[] = []

  if (tokens.length === 0) {
    return { query, matches: [], topicCount: 0, sectionCount: 0, glossaryCount: 0 }
  }

  for (const category of HELP_CATEGORIES) {
    for (const topic of category.topics) {
      const topicScore = scoreText(topicSearchBlob(topic, t), tokens)
      if (topicScore > 0) {
        matches.push({
          kind: 'topic',
          categoryId: category.id,
          topicId: topic.id,
          score: topicScore,
        })
      }

      for (const section of topic.sections) {
        const sectionScore = scoreText(sectionSearchBlob(section, topic, t), tokens)
        if (sectionScore > 0) {
          matches.push({
            kind: 'section',
            categoryId: category.id,
            topicId: topic.id,
            sectionId: section.id,
            score: sectionScore + 0.1,
          })
        }
      }
    }
  }

  for (const entry of GLOSSARY_ENTRIES) {
    const glossaryScore = scoreText(glossarySearchBlob(entry, t), tokens)
    if (glossaryScore > 0) {
      matches.push({
        kind: 'glossary',
        glossaryId: entry.id,
        score: glossaryScore,
      })
    }
  }

  matches.sort((a, b) => b.score - a.score)

  return {
    query,
    matches,
    topicCount: matches.filter((m) => m.kind === 'topic').length,
    sectionCount: matches.filter((m) => m.kind === 'section').length,
    glossaryCount: matches.filter((m) => m.kind === 'glossary').length,
  }
}

export function filterCategoriesBySearch(
  categories: HelpCategory[],
  query: string,
  t: TranslateFn,
): HelpCategory[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return categories

  return categories
    .map((category) => {
      const topics = category.topics
        .map((topic) => {
          const matchingSections = topic.sections.filter(
            (section) => scoreText(sectionSearchBlob(section, topic, t), tokens) > 0,
          )
          const topicMatches = scoreText(topicSearchBlob(topic, t), tokens) > 0
          if (!topicMatches && matchingSections.length === 0) return null
          return {
            ...topic,
            sections: topicMatches ? topic.sections : matchingSections,
          }
        })
        .filter((topic): topic is HelpTopic => topic !== null)

      if (topics.length === 0) return null
      return { ...category, topics }
    })
    .filter((category): category is HelpCategory => category !== null)
}

export function filterGlossaryBySearch(
  query: string,
  t: TranslateFn,
): GlossaryEntry[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return GLOSSARY_ENTRIES
  return GLOSSARY_ENTRIES.filter(
    (entry) => scoreText(glossarySearchBlob(entry, t), tokens) > 0,
  )
}

export function getTotalMatchCount(result: HelpSearchResult): number {
  return result.matches.length
}