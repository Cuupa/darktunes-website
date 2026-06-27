import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Concert, TourStop } from '@/types'
import type { ShowStatus } from '@/lib/tour-planner/types'
import { createConcert, updateConcert, setConcertArtists } from '@/lib/api/concerts'
import { createTourStop, updateTourStop } from '@/lib/api/tourStops'

type DbClient = SupabaseClient<Database>

const CONCERT_TO_SHOW_STATUS: Record<string, ShowStatus> = {
  announced: 'option',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
  ok: 'confirmed',
}

const SHOW_TO_CONCERT_STATUS: Record<ShowStatus, string> = {
  option: 'announced',
  confirmed: 'confirmed',
  'contract-sent': 'confirmed',
  'deposit-paid': 'confirmed',
  cancelled: 'cancelled',
}

export function concertStatusToShowStatus(status: string): ShowStatus {
  return CONCERT_TO_SHOW_STATUS[status] ?? 'option'
}

export function showStatusToConcertStatus(status: ShowStatus): string {
  return SHOW_TO_CONCERT_STATUS[status] ?? 'announced'
}

export function concertToStopFields(concert: Concert, tourId: string, artistId: string, sortOrder: number) {
  return {
    tour_id: tourId,
    artist_id: artistId,
    concert_id: concert.id,
    sort_order: sortOrder,
    stop_date: concert.concertDate,
    is_travel_day: false,
    venue_name: concert.venueName,
    venue_address: concert.venueAddress,
    venue_city: concert.venueCity,
    venue_country: concert.venueCountry,
    venue_lat: concert.venueLat,
    venue_lng: concert.venueLng,
    venue_validated: concert.venueLat !== null && concert.venueLng !== null,
    show_status: concertStatusToShowStatus(concert.status),
  }
}

export async function importConcertToTourStop(
  db: DbClient,
  concert: Concert,
  tourId: string,
  artistId: string,
  sortOrder: number,
) {
  return createTourStop(db, concertToStopFields(concert, tourId, artistId, sortOrder))
}

function resolveConcertArtistIds(stop: TourStop, performingArtistIds?: string[]): string[] {
  if (performingArtistIds && performingArtistIds.length > 0) {
    return [...new Set(performingArtistIds)]
  }
  return [stop.artistId]
}

export async function publishTourStopAsConcert(
  db: DbClient,
  stop: TourStop,
  userId: string,
  eventName?: string,
  performingArtistIds?: string[],
): Promise<Concert> {
  const payload = {
    artist_id: stop.artistId,
    event_name: eventName ?? stop.venueName ?? 'Live Show',
    concert_date: stop.stopDate,
    venue_name: stop.venueName,
    venue_address: stop.venueAddress,
    venue_city: stop.venueCity,
    venue_country: stop.venueCountry,
    venue_lat: stop.venueLat,
    venue_lng: stop.venueLng,
    status: showStatusToConcertStatus(stop.showStatus),
    created_by: userId,
    source: 'artist',
  }

  let concert: Concert
  if (stop.concertId) {
    concert = await updateConcert(db, stop.concertId, payload)
  } else {
    concert = await createConcert(db, payload)
    await updateTourStop(db, stop.id, { concert_id: concert.id })
  }

  await setConcertArtists(db, concert.id, resolveConcertArtistIds(stop, performingArtistIds))
  return concert
}

export async function syncLinkedConcertFromStop(
  db: DbClient,
  stop: TourStop,
  performingArtistIds?: string[],
): Promise<Concert | null> {
  if (!stop.concertId) return null
  const concert = await updateConcert(db, stop.concertId, {
    concert_date: stop.stopDate,
    venue_name: stop.venueName,
    venue_address: stop.venueAddress,
    venue_city: stop.venueCity,
    venue_country: stop.venueCountry,
    venue_lat: stop.venueLat,
    venue_lng: stop.venueLng,
    status: showStatusToConcertStatus(stop.showStatus),
  })
  await setConcertArtists(db, concert.id, resolveConcertArtistIds(stop, performingArtistIds))
  return concert
}

export async function syncLinkedStopFromConcert(db: DbClient, concert: Concert, stop: TourStop): Promise<TourStop> {
  return updateTourStop(db, stop.id, {
    stop_date: concert.concertDate,
    venue_name: concert.venueName,
    venue_address: concert.venueAddress,
    venue_city: concert.venueCity,
    venue_country: concert.venueCountry,
    venue_lat: concert.venueLat,
    venue_lng: concert.venueLng,
    show_status: concertStatusToShowStatus(concert.status),
  })
}