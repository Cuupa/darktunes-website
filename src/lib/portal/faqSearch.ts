import type { PortalFaqItem, PortalFaqTree } from '@/types'
import { resolveFaqLocaleField } from '@/lib/portal/faqLocale'
import { normalizeHelpSearchText } from '@/lib/portal/useHelpSearch'

export interface PortalFaqSearchMatch {
  categorySlug: string
  itemSlug: string
  score: number
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

function itemSearchBlob(item: PortalFaqItem, locale: string): string {
  const question = resolveFaqLocaleField(locale, item.questionEn, item.questionDe)
  const answer = resolveFaqLocaleField(locale, item.answerHtmlEn, item.answerHtmlDe)
  const plainAnswer = answer.replace(/<[^>]+>/g, ' ')
  return [question, plainAnswer, ...item.keywords].join(' ')
}

export function filterPortalFaqBySearch(
  tree: PortalFaqTree[],
  query: string,
  locale: string,
): PortalFaqTree[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return tree

  return tree
    .map((group) => {
      const items = group.items.filter((item) => {
        const blob = itemSearchBlob(item, locale)
        return scoreText(blob, tokens) > 0
      })
      return items.length > 0 ? { ...group, items } : null
    })
    .filter((group): group is PortalFaqTree => group !== null)
}

export function searchPortalFaq(
  tree: PortalFaqTree[],
  query: string,
  locale: string,
): PortalFaqSearchMatch[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const matches: PortalFaqSearchMatch[] = []
  for (const group of tree) {
    for (const item of group.items) {
      const score = scoreText(itemSearchBlob(item, locale), tokens)
      if (score > 0) {
        matches.push({
          categorySlug: group.category.slug,
          itemSlug: item.slug,
          score,
        })
      }
    }
  }
  return matches.sort((a, b) => b.score - a.score)
}

export function countPortalFaqMatches(matches: PortalFaqSearchMatch[]): number {
  return matches.length
}