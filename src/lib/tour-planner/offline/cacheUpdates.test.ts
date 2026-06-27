import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { tourPlannerKeys } from '@/lib/tour-planner/keys'
import { patchStopInCache } from './cacheUpdates'
import type { TourStop } from '@/types'

const stop: TourStop = {
  id: 'stop-1',
  tourId: 'tour-1',
  artistId: 'artist-1',
  concertId: null,
  sortOrder: 0,
  stopDate: '2026-09-15',
  isTravelDay: false,
  venueName: 'Venue',
  venueAddress: null,
  venueCity: null,
  venueCountry: null,
  venueLat: null,
  venueLng: null,
  venueValidated: false,
  hotelName: null,
  hotelAddress: null,
  hotelCity: null,
  hotelCountry: null,
  hotelLat: null,
  hotelLng: null,
  hotelValidated: false,
  arrivalTime: null,
  showStatus: 'option',
  daySchedule: null,
  deal: null,
  settlement: null,
  perDiems: [],
  rooming: [],
  travelManifest: [],
  venueDetails: null,
  venueContactInfo: null,
  guestList: [],
  guestListLimit: null,
  notes: null,
  externalGuestNotes: null,
  performingArtistIds: [],
  privateDataVersion: null,
  privateDataUpdatedAt: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

describe('patchStopInCache', () => {
  it('merges patch into cached stops', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(tourPlannerKeys.stops('artist-1', 'tour-1'), [stop])
    patchStopInCache(queryClient, 'artist-1', 'tour-1', 'stop-1', { venueName: 'Updated' })
    const updated = queryClient.getQueryData<TourStop[]>(tourPlannerKeys.stops('artist-1', 'tour-1'))
    expect(updated?.[0]?.venueName).toBe('Updated')
  })
})