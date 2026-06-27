import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Concert, TourStop } from '@/types'
import type { ShowStatus } from '@/lib/tour-planner/types'
import { createConcert, updateConcert } from '@/lib/api/concerts'
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

export async function publishTourStopAsConcert(
  db: DbClient,
  stop: TourStop,
  userId: string,
  eventName?: string,
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

  if (stop.concertId) {
    return updateConcert(db, stop.concertId, payload)
  }

  const concert = await createConcert(db, payload)
  await updateTourStop(db, stop.id, { concert_id: concert.id })
  return concert
}

export async function syncLinkedConcertFromStop(db: DbClient, stop: TourStop): Promise<Concert | null> {
  if (!stop.concertId) return null
  return updateConcert(db, stop.concertId, {
    concert_date: stop.stopDate,
    venue_name: stop.venueName,
    venue_address: stop.venueAddress,
    venue_city: stop.venueCity,
    venue_country: stop.venueCountry,
    venue_lat: stop.venueLat,
    venue_lng: stop.venueLng,
    status: showStatusToConcertStatus(stop.showStatus),
  })
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