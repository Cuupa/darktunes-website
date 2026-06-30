import type { Release } from '@/types'

export type CalendarScopeFilter = 'all' | 'mine'
export type CalendarTypeFilter = 'all' | 'single' | 'ep' | 'album'
export type CalendarSortOption = 'date-asc' | 'date-desc' | 'title-asc'

export interface CalendarFilterState {
  scope: CalendarScopeFilter
  type: CalendarTypeFilter
  search: string
  sort: CalendarSortOption
  currentArtistId: string | null
}

export function getReleaseArtistNames(release: Release): string | undefined {
  if (release.artists && release.artists.length > 0) {
    return release.artists.map((a) => a.name).join(', ')
  }
  return release.artistName || undefined
}

export function formatReleaseCellLabel(release: Release): string {
  const artists = getReleaseArtistNames(release)
  return artists ? `${artists} — ${release.title}` : release.title
}

export function filterReleasesByScope(
  releases: Release[],
  scope: CalendarScopeFilter,
  currentArtistId: string | null,
): Release[] {
  if (scope !== 'mine' || !currentArtistId) return releases
  return releases.filter((r) => {
    const isLegacy = r.artistId === currentArtistId
    const isJunction = r.artists?.some((a) => a.id === currentArtistId)
    return isLegacy || isJunction
  })
}

export function filterReleasesByType(
  releases: Release[],
  typeFilter: CalendarTypeFilter,
): Release[] {
  if (typeFilter === 'all') return releases
  return releases.filter((r) => r.type === typeFilter)
}

export function filterReleasesBySearch(releases: Release[], query: string): Release[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return releases
  return releases.filter((r) => {
    const artists = getReleaseArtistNames(r) ?? ''
    const haystack = `${r.title} ${artists}`.toLowerCase()
    return haystack.includes(normalized)
  })
}

export function sortReleases(releases: Release[], sort: CalendarSortOption): Release[] {
  const sorted = [...releases]
  sorted.sort((a, b) => {
    if (sort === 'title-asc') {
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    }
    const dateCompare = a.releaseDate.localeCompare(b.releaseDate)
    return sort === 'date-desc' ? -dateCompare : dateCompare
  })
  return sorted
}

export function applyCalendarFilters(
  releases: Release[],
  filters: CalendarFilterState,
): Release[] {
  let result = filterReleasesByScope(releases, filters.scope, filters.currentArtistId)
  result = filterReleasesByType(result, filters.type)
  result = filterReleasesBySearch(result, filters.search)
  return sortReleases(result, filters.sort)
}

export function releaseIsInMonth(
  release: Release,
  viewYear: number,
  viewMonth: number,
): boolean {
  if (!release.releaseDate) return false
  const [year, month] = release.releaseDate.split('-').map(Number)
  return year === viewYear && month === viewMonth
}