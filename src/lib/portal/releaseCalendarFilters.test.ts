import { describe, expect, it } from 'vitest'
import type { Concert, Release } from '@/types'
import {
  concertBelongsToArtist,
  filterCalendarConcerts,
  filterCalendarReleases,
  formatConcertArtistNames,
  releaseBelongsToArtist,
} from './releaseCalendarFilters'

const releaseA: Release = {
  id: 'r1',
  title: 'Nightfall',
  artistId: 'art-1',
  artistName: 'Alpha',
  releaseDate: '2026-03-01',
  coverArt: '',
  type: 'single',
  featured: false,
  isVisible: true,
  isPromo: false,
  artists: [{ id: 'art-1', name: 'Alpha', slug: 'alpha' }],
}

const releaseB: Release = {
  id: 'r2',
  title: 'Dawn',
  artistId: 'art-2',
  artistName: 'Beta',
  releaseDate: '2026-04-01',
  coverArt: '',
  type: 'album',
  featured: false,
  isVisible: true,
  isPromo: false,
  artists: [{ id: 'art-2', name: 'Beta', slug: 'beta' }],
}

const concertA: Concert = {
  id: 'c1',
  artistId: 'art-1',
  artistName: 'Alpha',
  eventName: 'Club Night',
  venueName: 'Void Club',
  venueAddress: null,
  venueCity: 'Berlin',
  venueCountry: 'DE',
  concertDate: '2026-05-10',
  ticketUrl: 'https://example.com/tix',
  songkickId: null,
  bandsintownId: null,
  status: 'ok',
  createdAt: '',
  updatedAt: '',
  eventTime: '21:00',
  eventType: 'gig',
  trailerUrl: null,
  venueLat: null,
  venueLng: null,
  venueOsmId: null,
  newsPostId: null,
  featuredArtists: [],
}

const concertFeatured: Concert = {
  ...concertA,
  id: 'c2',
  artistId: 'art-2',
  artistName: 'Beta',
  eventName: 'Festival Set',
  venueCity: 'Hamburg',
  featuredArtists: [{ id: 'art-1', name: 'Alpha', slug: 'alpha' }],
}

describe('releaseBelongsToArtist / concertBelongsToArtist', () => {
  it('matches primary and junction artists on releases', () => {
    expect(releaseBelongsToArtist(releaseA, 'art-1')).toBe(true)
    expect(releaseBelongsToArtist(releaseA, 'art-2')).toBe(false)
  })

  it('matches featured artists on concerts', () => {
    expect(concertBelongsToArtist(concertA, 'art-1')).toBe(true)
    expect(concertBelongsToArtist(concertFeatured, 'art-1')).toBe(true)
    expect(concertBelongsToArtist(concertFeatured, 'art-9')).toBe(false)
  })
})

describe('filterCalendarReleases', () => {
  it('filters mine + type + search (artists)', () => {
    const mine = filterCalendarReleases([releaseA, releaseB], {
      filterMode: 'mine',
      currentArtistId: 'art-1',
      typeFilter: 'all',
      searchQuery: '',
      sortOrder: 'asc',
    })
    expect(mine.map((r) => r.id)).toEqual(['r1'])

    const albums = filterCalendarReleases([releaseA, releaseB], {
      filterMode: 'all',
      currentArtistId: null,
      typeFilter: 'album',
      searchQuery: '',
      sortOrder: 'asc',
    })
    expect(albums.map((r) => r.id)).toEqual(['r2'])

    const search = filterCalendarReleases([releaseA, releaseB], {
      filterMode: 'all',
      currentArtistId: null,
      typeFilter: 'all',
      searchQuery: 'beta',
      sortOrder: 'asc',
    })
    expect(search.map((r) => r.id)).toEqual(['r2'])
  })
})

describe('filterCalendarConcerts', () => {
  it('filters mine + search by artist / venue / city', () => {
    const mine = filterCalendarConcerts([concertA, concertFeatured], {
      filterMode: 'mine',
      currentArtistId: 'art-1',
      searchQuery: '',
      sortOrder: 'asc',
    })
    expect(mine.map((c) => c.id).sort()).toEqual(['c1', 'c2'])

    const venue = filterCalendarConcerts([concertA, concertFeatured], {
      filterMode: 'all',
      currentArtistId: null,
      searchQuery: 'hamburg',
      sortOrder: 'asc',
    })
    expect(venue.map((c) => c.id)).toEqual(['c2'])
  })

  it('formats artist names including featured', () => {
    expect(formatConcertArtistNames(concertFeatured)).toBe('Beta, Alpha')
  })
})
