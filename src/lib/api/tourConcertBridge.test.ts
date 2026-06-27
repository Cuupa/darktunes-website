import { describe, expect, it } from 'vitest'
import {
  concertStatusToShowStatus,
  concertToStopFields,
  showStatusToConcertStatus,
} from '@/lib/api/tourConcertBridge'
import type { Concert } from '@/types'

const sampleConcert: Concert = {
  id: '11111111-1111-1111-1111-111111111111',
  artistId: '22222222-2222-2222-2222-222222222222',
  artistName: 'Test Artist',
  eventName: 'Live in Berlin',
  venueName: 'Columbiahalle',
  venueAddress: 'Columbiadamm 13',
  venueCity: 'Berlin',
  venueCountry: 'Germany',
  concertDate: '2026-09-15',
  ticketUrl: null,
  songkickId: null,
  bandsintownId: null,
  status: 'announced',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  eventTime: null,
  eventType: 'gig',
  trailerUrl: null,
  venueLat: 52.48,
  venueLng: 13.39,
  venueOsmId: null,
  newsPostId: null,
}

describe('tourConcertBridge', () => {
  it('maps concert status to show status', () => {
    expect(concertStatusToShowStatus('announced')).toBe('option')
    expect(concertStatusToShowStatus('confirmed')).toBe('confirmed')
    expect(concertStatusToShowStatus('cancelled')).toBe('cancelled')
  })

  it('maps show status to concert status', () => {
    expect(showStatusToConcertStatus('option')).toBe('announced')
    expect(showStatusToConcertStatus('deposit-paid')).toBe('confirmed')
    expect(showStatusToConcertStatus('cancelled')).toBe('cancelled')
  })

  it('builds stop fields from a concert', () => {
    const fields = concertToStopFields(
      sampleConcert,
      '33333333-3333-3333-3333-333333333333',
      sampleConcert.artistId!,
      2,
    )

    expect(fields).toMatchObject({
      tour_id: '33333333-3333-3333-3333-333333333333',
      artist_id: sampleConcert.artistId,
      concert_id: sampleConcert.id,
      sort_order: 2,
      stop_date: '2026-09-15',
      venue_name: 'Columbiahalle',
      venue_city: 'Berlin',
      show_status: 'option',
      venue_validated: true,
    })
  })
})