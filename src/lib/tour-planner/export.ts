import type { RouteResult } from './types'
import type { TrackStop as TourStop } from './mappers'
import { formatDuration } from './geocoding'

export function exportToText(
  stops: TourStop[],
  route: RouteResult | null,
  translations: { [key: string]: string }
): string {
  let output = `${translations.appTitle}\n`
  output += `${'='.repeat(50)}\n\n`

  output += `${translations.tourStops}\n`
  output += `${'-'.repeat(50)}\n`

  stops.forEach((stop, index) => {
    output += `\n${index + 1}. ${stop.date}\n`
    output += `   ${translations.venueName}: ${stop.venueName}\n`
    output += `   ${translations.venueAddress}: ${stop.venueAddress}, ${stop.venueCity}, ${stop.venueCountry}\n`
    if (stop.venueCoords) {
      output += `   Coordinates: ${stop.venueCoords.lat.toFixed(6)}, ${stop.venueCoords.lon.toFixed(6)}\n`
    }
    output += `\n`
    output += `   ${translations.hotelName}: ${stop.hotelName}\n`
    output += `   ${translations.hotelAddress}: ${stop.hotelAddress}, ${stop.hotelCity}, ${stop.hotelCountry}\n`
    if (stop.hotelCoords) {
      output += `   Coordinates: ${stop.hotelCoords.lat.toFixed(6)}, ${stop.hotelCoords.lon.toFixed(6)}\n`
    }
    output += `\n`
  })

  if (route && route.segments.length > 0) {
    output += `\n${translations.routeResults}\n`
    output += `${'-'.repeat(50)}\n\n`

    route.segments.forEach((segment, index) => {
      const typeLabel = getSegmentTypeLabel(segment.type, translations)
      output += `${index + 1}. ${typeLabel}\n`
      output += `   ${translations.from}: ${segment.from}\n`
      output += `   ${translations.to}: ${segment.to}\n`
      output += `   ${translations.distance}: ${segment.distance} km\n`
      output += `   ${translations.duration}: ${formatDuration(segment.duration, translations.hours, translations.minutes)}\n\n`
    })

    output += `${'-'.repeat(50)}\n`
    output += `${translations.totalDistance}: ${route.totalDistance} km\n`
    output += `${translations.totalDuration}: ${formatDuration(route.totalDuration, translations.hours, translations.minutes)}\n`
  }

  return output
}

export function exportToCSV(
  stops: TourStop[],
  route: RouteResult | null,
  translations: { [key: string]: string }
): string {
  let csv = ''

  csv += `${translations.date},${translations.venueName},${translations.venueAddress},${translations.venueCity},${translations.venueCountry},Venue Lat,Venue Lon,${translations.hotelName},${translations.hotelAddress},${translations.hotelCity},${translations.hotelCountry},Hotel Lat,Hotel Lon\n`

  stops.forEach(stop => {
    csv += `"${stop.date}",`
    csv += `"${stop.venueName}",`
    csv += `"${stop.venueAddress}",`
    csv += `"${stop.venueCity}",`
    csv += `"${stop.venueCountry}",`
    csv += `${stop.venueCoords ? stop.venueCoords.lat.toFixed(6) : ''},`
    csv += `${stop.venueCoords ? stop.venueCoords.lon.toFixed(6) : ''},`
    csv += `"${stop.hotelName}",`
    csv += `"${stop.hotelAddress}",`
    csv += `"${stop.hotelCity}",`
    csv += `"${stop.hotelCountry}",`
    csv += `${stop.hotelCoords ? stop.hotelCoords.lat.toFixed(6) : ''},`
    csv += `${stop.hotelCoords ? stop.hotelCoords.lon.toFixed(6) : ''}\n`
  })

  if (route && route.segments.length > 0) {
    csv += `\n${translations.routeResults}\n`
    csv += `${translations.type},${translations.from},${translations.to},${translations.distance} (km),${translations.duration} (min)\n`

    route.segments.forEach(segment => {
      const typeLabel = getSegmentTypeLabel(segment.type, translations)
      csv += `"${typeLabel}",`
      csv += `"${segment.from}",`
      csv += `"${segment.to}",`
      csv += `${segment.distance},`
      csv += `${segment.duration}\n`
    })

    csv += `\n${translations.totalDistance},${route.totalDistance} km\n`
    csv += `${translations.totalDuration},${formatDuration(route.totalDuration, translations.hours, translations.minutes)}\n`
  }

  return csv
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getSegmentTypeLabel(type: string, translations: { [key: string]: string }): string {
  switch (type) {
    case 'start':
      return translations.segmentStart
    case 'to-venue':
      return translations.segmentToVenue
    case 'to-hotel':
      return translations.segmentToHotel
    case 'to-next-hotel':
      return translations.segmentToNextHotel
    default:
      return type
  }
}
