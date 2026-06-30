import type { Release } from '@/types'

export type ReleaseTypeFilter = 'all' | 'single' | 'ep' | 'album'
export type ReleaseSortOrder = 'asc' | 'desc'

export function formatReleaseArtistNames(release: Release): string | undefined {
  if (release.artists && release.artists.length > 0) {
    return release.artists.map((a) => a.name).join(', ')
  }
  return release.artistName || undefined
}

export function filterCalendarReleases(
  releases: Release[],
  options: {
    filterMode: 'all' | 'mine'
    currentArtistId: string | null
    typeFilter: ReleaseTypeFilter
    searchQuery: string
    sortOrder: ReleaseSortOrder
  },
): Release[] {
  const { filterMode, currentArtistId, typeFilter, searchQuery, sortOrder } = options
  const query = searchQuery.trim().toLowerCase()

  let result = releases

  if (filterMode === 'mine' && currentArtistId) {
    result = result.filter((r) => {
      const isLegacy = r.artistId === currentArtistId
      const isJunction = r.artists?.some((a) => a.id === currentArtistId)
      return isLegacy || isJunction
    })
  }

  if (typeFilter !== 'all') {
    result = result.filter((r) => r.type === typeFilter)
  }

  if (query) {
    result = result.filter((r) => {
      const title = r.title.toLowerCase()
      const artists = formatReleaseArtistNames(r)?.toLowerCase() ?? ''
      return title.includes(query) || artists.includes(query)
    })
  }

  return [...result].sort((a, b) => {
    const cmp = a.releaseDate.localeCompare(b.releaseDate)
    return sortOrder === 'asc' ? cmp : -cmp
  })
}

export function isReleasePubliclyVisible(release: Release): boolean {
  return release.isVisible && !release.isPromo
}