import type { TourStop as DbTourStop } from '@/types'
import type { Coordinates } from '@/lib/tour-planner/types'

export interface TrackStop {
  id: string
  date: string
  venueName: string
  venueAddress: string
  venueCity: string
  venueCountry: string
  hotelName: string
  hotelAddress: string
  hotelCity: string
  hotelCountry: string
  venueCoords?: Coordinates
  hotelCoords?: Coordinates
  isTravelDay?: boolean
}

export function dbStopToTrack(stop: DbTourStop): TrackStop {
  return {
    id: stop.id,
    date: stop.stopDate,
    venueName: stop.venueName ?? '',
    venueAddress: stop.venueAddress ?? '',
    venueCity: stop.venueCity ?? '',
    venueCountry: stop.venueCountry ?? '',
    hotelName: stop.hotelName ?? '',
    hotelAddress: stop.hotelAddress ?? '',
    hotelCity: stop.hotelCity ?? '',
    hotelCountry: stop.hotelCountry ?? '',
    isTravelDay: stop.isTravelDay,
    venueCoords:
      stop.venueLat != null && stop.venueLng != null
        ? { lat: stop.venueLat, lon: stop.venueLng }
        : undefined,
    hotelCoords:
      stop.hotelLat != null && stop.hotelLng != null
        ? { lat: stop.hotelLat, lon: stop.hotelLng }
        : undefined,
  }
}