import type { Concert, Release } from '@/types'

export type ReleaseTypeFilter = 'all' | 'single' | 'ep' | 'album'
export type ReleaseSortOrder = 'asc' | 'desc'
/** What to show on the portal calendar grid. */
export type CalendarKindFilter = 'all' | 'releases' | 'events'
/** Ownership quick filter. */
export type CalendarOwnershipFilter = 'all' | 'mine'

export function formatReleaseArtistNames(release: Release): string | undefined {
  if (release.artists && release.artists.length > 0) {
    return release.artists.map((a) => a.name).join(', ')
  }
  return release.artistName || undefined
}

export function formatConcertArtistNames(concert: Concert): string | undefined {
  const names: string[] = []
  if (concert.artistName) names.push(concert.artistName)
  for (const a of concert.featuredArtists ?? []) {
    if (a.name && !names.includes(a.name)) names.push(a.name)
  }
  return names.length > 0 ? names.join(', ') : undefined
}

export function releaseBelongsToArtist(release: Release, artistId: string): boolean {
  if (release.artistId === artistId) return true
  return release.artists?.some((a) => a.id === artistId) ?? false
}

export function concertBelongsToArtist(concert: Concert, artistId: string): boolean {
  if (concert.artistId === artistId) return true
  return concert.featuredArtists?.some((a) => a.id === artistId) ?? false
}

export function filterCalendarReleases(
  releases: Release[],
  options: {
    filterMode: CalendarOwnershipFilter
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
    result = result.filter((r) => releaseBelongsToArtist(r, currentArtistId))
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

export function filterCalendarConcerts(
  concerts: Concert[],
  options: {
    filterMode: CalendarOwnershipFilter
    currentArtistId: string | null
    searchQuery: string
    sortOrder: ReleaseSortOrder
  },
): Concert[] {
  const { filterMode, currentArtistId, searchQuery, sortOrder } = options
  const query = searchQuery.trim().toLowerCase()

  let result = concerts

  if (filterMode === 'mine' && currentArtistId) {
    result = result.filter((c) => concertBelongsToArtist(c, currentArtistId))
  }

  if (query) {
    result = result.filter((c) => {
      const name = c.eventName.toLowerCase()
      const venue = (c.venueName ?? '').toLowerCase()
      const city = (c.venueCity ?? '').toLowerCase()
      const artists = formatConcertArtistNames(c)?.toLowerCase() ?? ''
      return (
        name.includes(query) ||
        venue.includes(query) ||
        city.includes(query) ||
        artists.includes(query)
      )
    })
  }

  return [...result].sort((a, b) => {
    const cmp = a.concertDate.localeCompare(b.concertDate)
    return sortOrder === 'asc' ? cmp : -cmp
  })
}

export function isReleasePubliclyVisible(release: Release): boolean {
  return release.isVisible && !release.isPromo
}
