import { describe, expect, it } from 'vitest'
import { filterPortalFaqBySearch, searchPortalFaq } from './faqSearch'
import type { PortalFaqTree } from '@/types'

const sampleTree: PortalFaqTree[] = [
  {
    category: {
      id: 'cat-1',
      slug: 'dashboard',
      titleEn: 'Dashboard',
      titleDe: null,
      sortOrder: 10,
      isPublished: true,
      createdAt: '',
      updatedAt: '',
    },
    items: [
      {
        id: 'item-1',
        categoryId: 'cat-1',
        slug: 'analytics-empty',
        questionEn: 'Why is my analytics data empty?',
        questionDe: null,
        answerHtmlEn: '<p>Try widening the date range.</p>',
        answerHtmlDe: null,
        keywords: ['analytics', 'no data'],
        portalRoute: '/portal/analytics',
        sortOrder: 10,
        isPublished: true,
        createdAt: '',
        updatedAt: '',
      },
    ],
  },
]

describe('faqSearch', () => {
  it('returns all groups when query is empty', () => {
    expect(filterPortalFaqBySearch(sampleTree, '', 'en')).toHaveLength(1)
  })

  it('filters by question text', () => {
    const filtered = filterPortalFaqBySearch(sampleTree, 'analytics empty', 'en')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.items).toHaveLength(1)
  })

  it('returns no matches for unrelated query', () => {
    expect(filterPortalFaqBySearch(sampleTree, 'invoices billing', 'en')).toHaveLength(0)
  })

  it('searchPortalFaq returns slug matches', () => {
    const matches = searchPortalFaq(sampleTree, 'analytics', 'en')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.itemSlug).toBe('analytics-empty')
  })
})